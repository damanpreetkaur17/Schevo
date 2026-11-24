import { apiRequest } from "./apiClient";
import { adoptAccountProjects, isAccountMode, schemaRepository } from "./schemaRepository";

export const projectRepository = {
  async list() {
    if (isAccountMode()) {
      const data = await apiRequest("/api/v1/projects");
      adoptAccountProjects(data.projects);
      return data.projects;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return schemaRepository.list();
  },
  create: schemaRepository.create,
  update: schemaRepository.update,
};
