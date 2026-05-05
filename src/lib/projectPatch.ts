import type { Project } from './storage';

export function applyProjectPatch(
  project: Project,
  patch: Partial<Project>,
  updatedAt = Date.now()
): Project {
  return { ...project, ...patch, updatedAt };
}
