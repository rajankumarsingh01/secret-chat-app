import api from "./api";

export const getLockStatus = (conversationId) => api.get(`/lock/${conversationId}/status`);
export const requestLock = (conversationId) => api.post(`/lock/${conversationId}/request-lock`);
export const confirmLock = (conversationId) => api.post(`/lock/${conversationId}/confirm-lock`);
export const rejectLock = (conversationId) => api.post(`/lock/${conversationId}/reject-lock`);
export const requestUnlock = (conversationId) => api.post(`/lock/${conversationId}/request-unlock`);
export const confirmUnlock = (conversationId) => api.post(`/lock/${conversationId}/confirm-unlock`);
export const rejectUnlock = (conversationId) => api.post(`/lock/${conversationId}/reject-unlock`);