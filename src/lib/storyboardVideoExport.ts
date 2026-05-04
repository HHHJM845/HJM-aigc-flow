export function createStoryboardVideoNodeData({
  index,
  imageSrc,
  shotDescription,
}: {
  index: number;
  imageSrc: string;
  shotDescription: string;
}) {
  return {
    label: `分镜 ${String(index).padStart(2, '0')}`,
    contentType: 'video' as const,
    content: null,
    referenceImage: imageSrc || undefined,
    shotDescription,
  };
}
