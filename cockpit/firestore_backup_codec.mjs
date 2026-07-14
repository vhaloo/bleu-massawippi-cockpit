const TYPE = "__cockpitBackupType";

export function encodeBackupValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    return { [TYPE]: "number", value: String(value) };
  }
  if (typeof value === "bigint") return { [TYPE]: "bigint", value: value.toString() };
  if (value instanceof Date) return { [TYPE]: "date", value: value.toISOString() };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { [TYPE]: "bytes", value: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) return { [TYPE]: "array", value: value.map(encodeBackupValue) };
  if (typeof value?.toDate === "function" && Number.isInteger(value.seconds)) {
    return { [TYPE]: "timestamp", seconds: String(value.seconds), nanoseconds: Number(value.nanoseconds || 0) };
  }
  if (typeof value?.latitude === "number" && typeof value?.longitude === "number") {
    return { [TYPE]: "geoPoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (typeof value?.path === "string" && value.firestore) {
    return { [TYPE]: "documentReference", path: value.path };
  }
  if (typeof value?.toArray === "function" && value.constructor?.name === "VectorValue") {
    return { [TYPE]: "vector", value: value.toArray() };
  }
  if (typeof value === "object") {
    return {
      [TYPE]: "map",
      value: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeBackupValue(item)]))
    };
  }
  throw new TypeError(`Type Firestore non pris en charge dans la sauvegarde : ${typeof value}`);
}

export function decodeBackupValue(value, { Timestamp, GeoPoint, db, vector } = {}) {
  if (value === null || typeof value !== "object") return value;
  const type = value[TYPE];
  if (!type) throw new TypeError("Valeur de sauvegarde non typée ou corrompue.");
  if (type === "number") {
    if (value.value === "NaN") return Number.NaN;
    if (value.value === "Infinity") return Number.POSITIVE_INFINITY;
    if (value.value === "-Infinity") return Number.NEGATIVE_INFINITY;
    throw new TypeError(`Nombre spécial inconnu : ${value.value}`);
  }
  if (type === "bigint") return BigInt(value.value);
  if (type === "date") return new Date(value.value);
  if (type === "bytes") return Buffer.from(value.value, "base64");
  if (type === "array") return value.value.map((item) => decodeBackupValue(item, { Timestamp, GeoPoint, db, vector }));
  if (type === "timestamp") {
    if (!Timestamp) return { seconds: BigInt(value.seconds), nanoseconds: value.nanoseconds };
    return new Timestamp(Number(value.seconds), Number(value.nanoseconds));
  }
  if (type === "geoPoint") return GeoPoint ? new GeoPoint(value.latitude, value.longitude) : { latitude: value.latitude, longitude: value.longitude };
  if (type === "documentReference") return db ? db.doc(value.path) : { path: value.path };
  if (type === "vector") return vector ? vector(value.value) : { values: [...value.value] };
  if (type === "map") {
    return Object.fromEntries(Object.entries(value.value).map(([key, item]) => [key, decodeBackupValue(item, { Timestamp, GeoPoint, db, vector })]));
  }
  throw new TypeError(`Type de sauvegarde inconnu : ${type}`);
}

export function isBackupEnvelope(value) {
  return Boolean(value && typeof value === "object" && value[TYPE]);
}
