import api from "../../services/api";

export const fetchLiveClasses = async () => {
	const res = await api.get("live-classes/");
	return res.data;
};

export const createLiveClass = async (payload) => {
	const res = await api.post("live-classes/", payload);
	return res.data;
};

export const getLiveClass = async (id) => {
	const res = await api.get(`live-classes/${id}/`);
	return res.data;
};

export const deleteLiveClass = async (id) => {
	const res = await api.delete(`live-classes/${id}/`);
	return res.data;
};
