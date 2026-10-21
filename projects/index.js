import kampteeConfig from "./kamptee/config.js";

/**
 * Registry of all mine projects served by this backend.
 * Add a new mine by dropping in projects/<id>/config.js and registering it here.
 */
const projects = {
  [kampteeConfig.projectId]: kampteeConfig
};

export const getProjectConfig = (projectId = "kamptee") => {
  const config = projects[projectId];
  if (!config) {
    throw new Error(`Unknown project: ${projectId}`);
  }
  return config;
};

export const listProjects = () => Object.values(projects);

export default projects;
