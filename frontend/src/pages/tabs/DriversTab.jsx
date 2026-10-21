import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../../components/common/StateBlock.jsx";
import DriverLeaderboard from "../../components/employees/DriverLeaderboard.jsx";

export default function DriversTab() {
  const { data: drivers, loading, error } = useFetch(() => api.get("/drivers/leaderboard"), []);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-text">Driver Performance Leaderboard</h2>
      <StateBlock loading={loading} error={error} empty={drivers?.length === 0} emptyLabel="No drivers added yet">
        {drivers && <DriverLeaderboard drivers={drivers} />}
      </StateBlock>
    </div>
  );
}
