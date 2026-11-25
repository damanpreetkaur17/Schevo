import { apiRequest } from "./apiClient.js";
import { adoptAccountProjects, isAccountMode, schemaRepository } from "./schemaRepository.js";

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
  async delete(id) {
    if (isAccountMode()) {
      await schemaRepository.prepareDelete(id);
      await apiRequest(`/api/v1/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
    schemaRepository.remove(id);
  },
  create: schemaRepository.create,
  update: schemaRepository.update,
};
