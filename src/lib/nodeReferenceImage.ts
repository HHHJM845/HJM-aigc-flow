import type { Edge, Node } from '@xyflow/react';

export function getFirstImageFromNode(node: Node): string | undefined {
  if (node.type !== 'imageNode' || !node.data.content) return undefined;
  const contents = Array.isArray(node.data.content) ? node.data.content : [node.data.content];
  const first = contents[0];
  return typeof first === 'string' && first ? first : undefined;
}

export function resolveReferenceImageForNode(
  node: Node,
  nodes: Node[],
  edges: Edge[]
): string | undefined {
  if (node.type !== 'imageNode' && node.type !== 'videoNode') return undefined;

  for (const edge of edges) {
    if (edge.target !== node.id) continue;
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) continue;
    const image = getFirstImageFromNode(sourceNode);
    if (image) return image;
  }

  const existing = node.data.referenceImage;
  return typeof existing === 'string' && existing ? existing : undefined;
}
