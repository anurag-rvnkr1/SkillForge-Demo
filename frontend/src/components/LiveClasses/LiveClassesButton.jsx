import React from "react";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";

const LiveClassesButton = () => {
	const goToLiveClasses = () => {
		window.location.href = "/tutor/community/live-classes";
	};

	return (
		<Button
			variant="primary"
			onClick={goToLiveClasses}
			className="flex items-center text-xs sm:text-sm"
		>
			<Video className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
			<span className="hidden sm:inline">Live Classes</span>
		</Button>
	);
};

export default LiveClassesButton;
