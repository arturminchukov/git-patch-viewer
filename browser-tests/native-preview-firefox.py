#!/usr/bin/env python3
"""Native temporary Firefox installation test using stdlib WebDriver HTTP."""
import argparse
import base64
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'
POSTGRESQL = 'https://www.postgresql.org/message-id/attachment/202759/v6-0001-Add-pg_xmin_horizon-view-showing-per-input-horizo.patch'


def eventually(check, timeout=20):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        try:
            value = check()
            if value:
                return value
        except (urllib.error.URLError, RuntimeError, KeyError) as error:
            last = error
        time.sleep(0.1)
    raise AssertionError(f'Condition timed out: {last}')


class Driver:
    def __init__(self, base):
        self.base = base
        self.session = None

    def request(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, method=method, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=70) as response:
                result = json.load(response)['value']
        except urllib.error.HTTPError as error:
            raise RuntimeError(error.read().decode()) from error
        if isinstance(result, dict) and result.get('error'):
            raise RuntimeError(result)
        return result

    def command(self, method, path, body=None):
        return self.request(method, '/session/' + self.session + path, body)

    def script(self, source, *args):
        return self.command('POST', '/execute/sync', {'script': source, 'args': list(args)})

    def async_script(self, source, *args):
        return self.command('POST', '/execute/async', {'script': source, 'args': list(args)})

    def context(self, value):
        self.command('POST', '/moz/context', {'context': value})

    def switch(self, handle):
        self.command('POST', '/window', {'handle': handle})

    def handles(self):
        return self.command('GET', '/window/handles')

    def navigate(self, url):
        self.command('POST', '/url', {'url': url})

    def click(self, selector):
        element = self.command('POST', '/element', {'using': 'css selector', 'value': selector})[ELEMENT]
        self.command('POST', '/element/' + element + '/click', {})


def run(args):
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='gpv-native-firefox-', dir=os.environ.get('TMPDIR')) as folder:
        temp = Path(folder)
        downloads = temp / 'downloads'
        downloads.mkdir()
        addon = temp / 'extension.xpi'
        # Fixture host grants avoid browser-chrome permission prompt automation.
        # The production manifest remains optional, and explicit site opt-in is
        # exercised through the real popup and native storage/messages.
        with zipfile.ZipFile(addon, 'w', zipfile.ZIP_DEFLATED) as archive:
            for file in (ROOT / 'dist-firefox').rglob('*'):
                if not file.is_file():
                    continue
                name = str(file.relative_to(ROOT / 'dist-firefox'))
                if name == 'manifest.json':
                    manifest = json.loads(file.read_text())
                    manifest['host_permissions'] = ['http://127.0.0.1/*', 'https://www.postgresql.org/*']
                    archive.writestr(name, json.dumps(manifest))
                else:
                    archive.write(file, name)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        fixture = subprocess.Popen(['node', str(ROOT / 'browser-tests/native-preview-server.mjs')], stdout=subprocess.PIPE, text=True)
        fixture_url = json.loads(fixture.stdout.readline())['url']
        with (output / 'geckodriver.log').open('w') as log:
            process = subprocess.Popen([args.geckodriver, '--allow-system-access', '--host', '127.0.0.1', '--port', str(port)], stdout=log, stderr=log)
            driver = Driver(f'http://127.0.0.1:{port}')
            try:
                eventually(lambda: driver.request('GET', '/status'))
                session = driver.request('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'firefox', 'moz:firefoxOptions': {
                    'binary': args.firefox,
                    'args': ['-headless'],
                    'prefs': {
                        'xpinstall.signatures.required': False,
                        'browser.download.folderList': 2,
                        'browser.download.dir': str(downloads),
                        'browser.download.useDownloadDir': True,
                        'browser.download.alwaysOpenPanel': False,
                        'browser.helperApps.neverAsk.saveToDisk': 'application/octet-stream,text/plain',
                    },
                }}}})
                driver.session = session['sessionId']
                driver.command('POST', '/timeouts', {'script': 60_000, 'pageLoad': 60_000})
                identifier = driver.command('POST', '/moz/addon/install', {'path': str(addon), 'temporary': True})
                driver.context('chrome')
                mapping = driver.script('return JSON.parse(Services.prefs.getStringPref("extensions.webextensions.uuids"));')
                origin = 'moz-extension://' + mapping[identifier]
                driver.context('content')
                source = driver.command('GET', '/window')
                driver.navigate(fixture_url)
                driver.click('#octet')
                eventually(lambda: (downloads / 'octet.patch').exists())
                baseline_handles = driver.handles()
                driver.context('chrome')
                driver.script('Services.wm.getMostRecentWindow("navigator:browser").gBrowser.addTab(arguments[0], {triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(), inBackground: true});', origin + '/popup.html')
                driver.context('content')
                popup = eventually(lambda: next((h for h in driver.handles() if h not in baseline_handles), None))
                driver.switch(popup)
                eventually(lambda: driver.script('return !!document.getElementById("preview-toggle");'))
                # Firefox's WebDriver selects a full-page popup tab, not the real
                # toolbar popup. Seed its opt-in through native extension storage;
                # actual popup interaction is exercised by the Chrome harness.
                assert driver.async_script('const [url,done]=arguments;chrome.permissions.contains({origins:["http://127.0.0.1/*"]}).then(granted=>chrome.storage.local.set({"gpv-preview-origins":[url]}).then(()=>done(granted)));', fixture_url) is True
                eventually(lambda: driver.async_script('const done=arguments[arguments.length-1]; chrome.scripting.getRegisteredContentScripts().then(s=>done(s.some(x=>x.id==="gpv-preview-links")));'))

                def refresh():
                    driver.switch(popup)
                    return driver.async_script('''const [url,done]=arguments;
                        chrome.tabs.query({}).then(tabs=>{
                          const tab=tabs.find(t=>t.url===url+'/');
                          return chrome.scripting.executeScript({target:{tabId:tab.id},func:async()=>{
                            if(!globalThis.__gpvPreviewLinks)return false;
                            await globalThis.__gpvPreviewLinks();return true;
                          }});
                        }).then(r=>done(r[0]?.result),e=>done(false));''', fixture_url)

                eventually(refresh)
                for case in ['octet', 'attachment', 'download']:
                    driver.switch(source)
                    before = driver.handles()
                    driver.click('#' + case)
                    viewer = eventually(lambda: next((h for h in driver.handles() if h not in before), None))
                    driver.switch(viewer)
                    eventually(lambda: driver.script('return document.getElementById("git-patch-viewer-host")?.shadowRoot?.querySelectorAll(".gpv-file").length;') == 1)
                    text = driver.script('return document.getElementById("git-patch-viewer-host").shadowRoot.querySelector(".gpv-content").textContent;')
                    assert 'new value' in text and '2.43.0' not in text
                    assert driver.script('return !!window.untrustedPatchExecuted;') is False
                    assert driver.script('return document.getElementById("git-patch-viewer-host").shadowRoot.querySelectorAll(".gpv-code img").length;') == 0
                    (output / f'native-firefox-{case}.png').write_bytes(base64.b64decode(driver.command('GET', '/screenshot')))
                    driver.command('DELETE', '/window')
                assert sorted(p.name for p in downloads.iterdir()) == ['octet.patch']
                driver.switch(source)
                before = driver.handles()
                driver.click('#giant')
                giant = eventually(lambda: next((h for h in driver.handles() if h not in before), None))
                driver.switch(giant)
                eventually(lambda: driver.script('return document.getElementById("git-patch-viewer-host")?.shadowRoot?.querySelectorAll(".gpv-large-file button").length;') == 3, timeout=45)
                assert driver.script('return document.getElementById("git-patch-viewer-host").shadowRoot.querySelectorAll(".gpv-code").length;') == 0
                driver.script('document.getElementById("git-patch-viewer-host").shadowRoot.querySelector(".gpv-large-file button").click();')
                eventually(lambda: driver.script('return document.getElementById("git-patch-viewer-host").shadowRoot.querySelectorAll(".gpv-line-truncated").length;') == 2)
                driver.command('DELETE', '/window')
                driver.switch(source)
                before = driver.handles()
                driver.click('#invalid')
                eventually(lambda: (downloads / 'invalid.patch').exists())
                eventually(lambda: set(driver.handles()) == set(before))
                driver.switch(source)
                assert driver.command('GET', '/url') == fixture_url + '/'
                if args.live:
                    driver.switch(popup)
                    driver.async_script('const done=arguments[arguments.length-1];chrome.storage.local.get("gpv-preview-origins").then(s=>chrome.storage.local.set({"gpv-preview-origins":[...s["gpv-preview-origins"],"https://www.postgresql.org"]})).then(()=>done(true));')
                    eventually(refresh)
                    driver.switch(source)
                    driver.script('const a=document.createElement("a");a.id="postgresql";a.href=arguments[0];a.textContent="Live PostgreSQL patch";document.body.append(a);', POSTGRESQL)
                    before = driver.handles()
                    driver.click('#postgresql')
                    viewer = eventually(lambda: next((h for h in driver.handles() if h not in before), None))
                    driver.switch(viewer)
                    eventually(lambda: driver.script('return document.getElementById("git-patch-viewer-host")?.shadowRoot?.querySelectorAll(".gpv-file").length;') == 19, timeout=40)
                    (output / 'native-firefox-postgresql.png').write_bytes(base64.b64decode(driver.command('GET', '/screenshot')))
                    driver.command('DELETE', '/window')
                driver.switch(popup)
                driver.async_script('const done=arguments[arguments.length-1];chrome.storage.local.set({"gpv-preview-origins":[]}).then(()=>done(true));')
                driver.switch(source)
                driver.click('#attachment')
                eventually(lambda: (downloads / 'attachment.diff').exists())
                result = {'scenario': 'native-firefox', 'cases': ['disabled', 'octet-stream', 'attachment', 'download-attribute', 'failure-replay', 'disable-existing-tab'], 'livePostgreSQL': args.live}
                (output / 'result.json').write_text(json.dumps(result, indent=2))
                print(json.dumps(result), flush=True)
            finally:
                if driver.session:
                    try:
                        driver.request('DELETE', '/session/' + driver.session)
                    except Exception:
                        pass
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                fixture.terminate()
                fixture.wait(timeout=10)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--firefox', required=True)
    parser.add_argument('--geckodriver', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--live', action='store_true')
    run(parser.parse_args())
