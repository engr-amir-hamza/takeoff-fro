export const Tool = {
  PAN: 'pan',
  SELECT: 'select',
  CALIBRATE: 'calibrate',
  LENGTH: 'length',
  AREA: 'area',
  COUNT: 'count'
};

export function createProjectMeta(fileName, fileType) {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    fileName,
    fileType,
    pages: [],
    takeoffs: [],
    calibrationByPage: {}
  };
}
