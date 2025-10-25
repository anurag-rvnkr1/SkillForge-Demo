import React, { useEffect, useState } from "react";
import { fetchLiveClasses, createLiveClass } from "@/lib/api/liveclasses";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";

const LiveClassesPage = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  
  const role = useSelector((state) => state.auth.role);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchLiveClasses();
      setClasses(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!title) return alert("Title required");
    const roomName = `SkillForge_Live_${Date.now()}`;
    const jitsiUrl = `https://meet.jit.si/${roomName}`;
    try {
      const payload = { title, topic, jitsi_link: jitsiUrl };
      await createLiveClass(payload);
      setShowCreate(false);
      setTitle("");
      setTopic("");
      await load();
    } catch (err) {
      console.error(err);
      alert("Error creating live class");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Live Classes</h2>
        {role === "tutor" && (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            Create New Live Class
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="font-semibold mb-2">New Live Class</h3>
          <input
            className="border p-2 w-full mb-2"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="border p-2 w-full mb-2"
            placeholder="Topic / Description"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <div className="flex space-x-2">
            <Button onClick={handleCreate}>Create</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <div>Loading...</div>}
        {classes.map((c) => (
          <div key={c.id} className="p-4 bg-white rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">{c.title}</h4>
              <span
                className={`px-2 py-1 text-xs rounded ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {c.is_active ? 'Active' : 'Closed'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{c.topic}</p>
            <p className="text-xs text-gray-500 mb-4">Tutor: {c.tutor_name}</p>
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  // Open Jitsi meeting in a new tab so chat on community remains available
                  try {
                    window.open(c.jitsi_link, "_blank", "noopener,noreferrer");
                  } catch (err) {
                    // fallback
                    window.location.href = c.jitsi_link;
                  }
                }}
              >
                Join Class
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.jitsi_link);
                    window.alert("Live class link copied to clipboard.");
                  } catch (e) {
                    // fallback
                    const dummy = document.createElement("textarea");
                    document.body.appendChild(dummy);
                    dummy.value = c.jitsi_link;
                    dummy.select();
                    document.execCommand("copy");
                    document.body.removeChild(dummy);
                    window.alert("Live class link copied to clipboard.");
                  }
                }}
              >
                Copy Link
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Note: joining opens the Jitsi meeting in a new tab; chat remains on the community page */}
    </div>
  );
};

export default LiveClassesPage;
