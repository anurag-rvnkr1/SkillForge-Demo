import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

// Basic banned list to match backend moderation
const BANNED = ["offensiveword1", "offensiveword2"];

const containsBanned = (text) => {
	if (!text) return false;
	const lower = text.toLowerCase();
	return BANNED.some((b) => lower.includes(b));
};

const ClassRoomDetail = ({ liveClass, onClose }) => {
	const userID = useSelector((s) => s.auth.id);
	const wsRef = useRef(null);
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState("");

	useEffect(() => {
		// connect to websocket for this live class
		const base = import.meta.env.VITE_API_WS || import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
		const wsProto = base.startsWith("https") ? "wss" : "ws";
		const host = base.replace(/^https?:\/\//, "");
		const wsUrl = `${wsProto}://${host}/ws/live-class/${liveClass.id}/`;

		const ws = new WebSocket(wsUrl);
		ws.onopen = () => console.log("LiveClass websocket open");
		ws.onmessage = (ev) => {
			try {
				const data = JSON.parse(ev.data);
				if (data.type === "chat_message") {
					setMessages((m) => [...m, { user: data.user, content: data.content, id: Date.now() }]);
				} else if (data.type === "moderation_rejected") {
					alert(data.message);
				}
			} catch (e) {
				console.error(e);
			}
		};
		ws.onerror = (e) => console.error("ws error", e);
		ws.onclose = () => console.log("ws closed");
		wsRef.current = ws;

		return () => {
			ws && ws.close();
		};
	}, [liveClass.id]);

	const sendMessage = () => {
		if (!input.trim()) return;
		if (containsBanned(input)) return alert("Message blocked by moderation");
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ message: input, user: userID, type: "chat" }));
			setInput("");
		} else {
			alert("Not connected");
		}
	};

	// Jitsi iframe
	const iframeStyle = { width: "100%", height: "60vh", border: 0 };

	return (
		<div className="flex flex-col h-full">
			<div className="mb-4">
				<div className="w-full">
					<iframe
						title={`jitsi-${liveClass.id}`}
						src={liveClass.jitsi_link}
						style={iframeStyle}
						allow="camera; microphone; fullscreen; display-capture"
					/>
				</div>
			</div>

			<div className="flex-1 flex flex-col">
				<div className="flex-1 overflow-auto bg-gray-50 p-3 rounded mb-2">
					{messages.map((m, idx) => (
						<div key={idx} className="mb-2">
							<strong className="mr-2">{m.user}:</strong>
							<span>{m.content}</span>
						</div>
					))}
				</div>
				<div className="flex space-x-2">
					<input
						className="flex-1 border p-2 rounded"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Type a message"
					/>
					<button onClick={sendMessage} className="bg-indigo-600 text-white px-4 rounded">
						Send
					</button>
				</div>
			</div>
		</div>
	);
};

export default ClassRoomDetail;
