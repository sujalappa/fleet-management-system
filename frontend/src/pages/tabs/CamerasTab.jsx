import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../../components/common/StateBlock.jsx";
import CameraEventFeed from "../../components/cameras/CameraEventFeed.jsx";

export default function CamerasTab() {
  const { data: events, loading, error, refetch } = useFetch(() => api.get("/cameras/events"), []);

  const handleAcknowledge = async (id) => {
    await api.put(`/cameras/events/${id}/acknowledge`);
    refetch();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text">AI Safety Alert Feed</h2>
        <StateBlock loading={loading} error={error} empty={events?.length === 0} emptyLabel="No cameras connected yet">
          {events && <CameraEventFeed events={events} onAcknowledge={handleAcknowledge} />}
        </StateBlock>
      </div>
    </div>
  );
}
