const STORAGE_KEY = 'chronos_materials';

export function readMaterials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMaterials(materials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
  emitMaterialsChange();
}

export function updateMaterial(id, patch) {
  const materials = readMaterials();
  const index = materials.findIndex((item) => item.id === id);
  if (index < 0) return null;
  materials[index] = { ...materials[index], ...patch };
  saveMaterials(materials);
  return materials[index];
}

export function deleteMaterial(id) {
  saveMaterials(readMaterials().filter((item) => item.id !== id));
}

export function getReadyMaterials() {
  return readMaterials()
    .filter((material) => material.analysis && material.status !== 'processing')
    .sort((a, b) => (b.processedAt || b.uploadedAt || 0) - (a.processedAt || a.uploadedAt || 0));
}

export function emitMaterialsChange() {
  window.dispatchEvent(new CustomEvent('chronos:materials'));
}
