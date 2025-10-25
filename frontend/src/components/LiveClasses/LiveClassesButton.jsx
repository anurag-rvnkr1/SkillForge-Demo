import React from "react";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { createLiveClass } from "@/lib/api/liveclasses";

const LiveClassesButton = () => {
	const role = useSelector((state) => state.auth.role);
	const navigate = useNavigate();

	const handleClick = () => {
		if (role !== "tutor") {
			// Show a simple popup informing only tutors can create live classes
			// You can replace this with a nicer toast/modal as desired
			window.alert("Only tutors can create Live Classes.");
			return;
		}
			// Directly create a new live meeting and open it in a new tab
			(async () => {
				try {
					const roomName = `SkillForge_Live_${Date.now()}`;
					const jitsiUrl = `https://meet.jit.si/${roomName}`;
					// create live class on server
					await createLiveClass({ title: `Live Class ${new Date().toLocaleString()}`, topic: "", jitsi_link: jitsiUrl });
					// open meeting in new tab
					window.open(jitsiUrl, "_blank", "noopener,noreferrer");
				} catch (err) {
					console.error(err);
					window.alert("Unable to create live class. Please try again.");
				}
			})();
	};

	return (
		<Button
			variant="primary"
			onClick={handleClick}
			className="flex items-center text-xs sm:text-sm"
		>
			<Video className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
			<span className="hidden sm:inline">Live Classes</span>
		</Button>
	);
};

export default LiveClassesButton;
