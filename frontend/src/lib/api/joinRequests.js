import api from "@/services/api";

export const requestJoinCommunity = async (slug) => {
  const res = await api.post(`community/${slug}/join/`);
  return res.data;
};

export const fetchJoinRequests = async (slug) => {
  const res = await api.get(`community/${slug}/join-requests/`);
  return res.data;
};

export const respondJoinRequest = async (slug, pk, action) => {
  const res = await api.post(`community/${slug}/join-requests/${pk}/approve/`, { action });
  return res.data;
};

export const removeParticipant = async (slug, user_id) => {
  const res = await api.post(`community/${slug}/remove-participant/`, { user_id });
  return res.data;
};
