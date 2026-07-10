// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../core/parser';
import { renderFiles } from './render';

// jsdom rewrites import.meta.url to an http URL, so resolve from the repo root.
const samplePath = join(process.cwd(), 'demo/sample.patch');
const model = parse(readFileSync(samplePath, 'utf8'));

describe('renderFiles — DOM smoke test', () => {
  it('renders one section per file with a stable id', () => {
    const frag = renderFiles(model.files);
    const host = document.createElement('div');
    host.append(frag);

    const sections = host.querySelectorAll('.gpv-file');
    expect(sections).toHaveLength(model.files.length);
    expect(host.querySelector('#gpv-file-0')).not.toBeNull();
    expect(host.querySelector(`#gpv-file-${model.files.length - 1}`)).not.toBeNull();
  });

  it('lays out four grid cells (old#, left, new#, right) per row', () => {
    const frag = renderFiles(model.files.slice(0, 1));
    const host = document.createElement('div');
    host.append(frag);

    const rows = host.querySelector('.gpv-rows')!;
    // Each visual row contributes exactly 4 direct children.
    expect(rows.children.length % 4).toBe(0);
    expect(rows.children.length).toBeGreaterThan(0);
  });

  it('emits strongly-highlighted segments for a changed line pair', () => {
    // The CHANGELOG hunk has a `+`/`-`-free change, so use response_logs.go
    // which contains real changed pairs; assert at least one appears somewhere.
    const frag = renderFiles(model.files);
    const host = document.createElement('div');
    host.append(frag);
    expect(host.querySelectorAll('.gpv-seg-changed').length).toBeGreaterThan(0);
  });

  it('applies add/remove background classes to code cells', () => {
    const frag = renderFiles(model.files);
    const host = document.createElement('div');
    host.append(frag);
    expect(host.querySelectorAll('.gpv-code.add').length).toBeGreaterThan(0);
    expect(host.querySelectorAll('.gpv-code.remove').length).toBeGreaterThan(0);
  });
});
