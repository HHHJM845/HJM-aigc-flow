import assert from 'node:assert/strict';
import type { Edge, Node } from '@xyflow/react';
import {
  getFirstImageFromNode,
  resolveReferenceImageForNode,
} from '../src/lib/nodeReferenceImage';

const imageNode: Node = {
  id: 'storyboard-1',
  type: 'imageNode',
  position: { x: 0, y: 0 },
  data: { content: ['data:image/png;base64,from-storyboard'] },
};

assert.equal(getFirstImageFromNode(imageNode), 'data:image/png;base64,from-storyboard');

const exportedVideoNode: Node = {
  id: 'export-storyboard-1',
  type: 'videoNode',
  position: { x: 0, y: 0 },
  data: { referenceImage: 'data:image/png;base64,embedded-ref' },
};

assert.equal(
  resolveReferenceImageForNode(exportedVideoNode, [exportedVideoNode], []),
  'data:image/png;base64,embedded-ref'
);

const edge: Edge = {
  id: 'edge-1',
  source: imageNode.id,
  target: exportedVideoNode.id,
};

assert.equal(
  resolveReferenceImageForNode(
    exportedVideoNode,
    [imageNode, exportedVideoNode],
    [edge]
  ),
  'data:image/png;base64,from-storyboard'
);

console.log('node reference image behavior ok');
