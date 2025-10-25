import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from "@/components/ui/tabs";
import { useSelector } from "react-redux";
import {
  fetchJoinRequests,
  respondJoinRequest,
  removeParticipant,
} from "@/lib/api/joinRequests";

const ParticipantsTab = ({ participants = [], slug }) => {
  const role = useSelector((s) => s.auth.role);
  const [showRequests, setShowRequests] = useState(false);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    if (showRequests) loadRequests();
  }, [showRequests, filter]);

  const loadRequests = async () => {
    try {
      const data = await fetchJoinRequests(slug);
      setRequests(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRespond = async (pk, action) => {
    try {
      await respondJoinRequest(slug, pk, action);
      await loadRequests();
      // optionally refresh participants list by reloading parent page
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Operation failed");
    }
  };

  const handleRemove = async (userId) => {
    if (!confirm("Remove this participant from the community?")) return;
    try {
      await removeParticipant(slug, userId);
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Failed to remove participant");
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  return (
    <TabsContent value="participants">
      <div className="p-2 sm:p-4">
        {role === "tutor" && (
          <div className="mb-3 flex items-center space-x-2">
            <button
              className="px-3 py-1 bg-indigo-600 text-white rounded"
              onClick={() => setShowRequests(!showRequests)}
            >
              {showRequests ? "Requests" : "Requests"}
            </button>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border rounded p-1 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
        )}

        {showRequests && role === "tutor" && (
          <div className="mb-4">
            {filteredRequests.length === 0 && <div>No requests</div>}
            {filteredRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">{r.user_name}</div>
                  <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                </div>
                <div className="space-x-2">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleRespond(r.id, "approve")}
                        className="px-2 py-1 bg-green-600 text-white rounded text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRespond(r.id, "reject")}
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.status !== "pending" && <div className="text-sm">{r.status}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Horizontal divider between requests and participants */}
        {showRequests && role === "tutor" && (
          <div className="my-4">
            <div className="border-t border-gray-900" />
          </div>
        )}

        <ScrollArea className="h-[calc(100vh-280px)] sm:h-[calc(100vh-300px)] p-2 sm:p-4">
          {participants.map((participant, index) => (
            <div key={index} className="flex items-center mb-2 justify-between">
              <div className="flex items-center">
                <Avatar className="w-6 h-6 sm:w-8 sm:h-8 mr-2">
                  <AvatarImage src={participant?.profile} />
                  <AvatarFallback>{participant?.username[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm sm:text-base">{participant?.username}</span>
              </div>
              {role === "tutor" && (
                <button
                  onClick={() => handleRemove(participant?.id)}
                  className="text-sm px-2 py-1 bg-red-600 text-white rounded"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </ScrollArea>
      </div>
    </TabsContent>
  );
};

export default ParticipantsTab;
