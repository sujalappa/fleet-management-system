import useFetch from "../../hooks/useFetch.js";
import api from "../../services/api.js";
import StateBlock from "../../components/common/StateBlock.jsx";
import KPICard from "../../components/common/KPICard.jsx";
import FleetTable from "../../components/fleet/FleetTable.jsx";
import MaintenanceTable from "../../components/fleet/MaintenanceTable.jsx";
import AlertFeed from "../../components/fleet/AlertFeed.jsx";
import ServiceHistoryTable from "../../components/fleet/ServiceHistoryTable.jsx";

export default function FleetTab() {
  const { data: fleetData, loading, error } = useFetch(() => api.get("/fleet/live"), []);
  const {
    data: maintenance,
    loading: maintenanceLoading,
    error: maintenanceError
  } = useFetch(() => api.get("/maintenance"), []);
  const {
    data: alerts,
    loading: alertsLoading,
    error: alertsError,
    refetch: refetchAlerts
  } = useFetch(() => api.get("/alerts"), []);
  const {
    data: serviceHistory,
    loading: serviceHistoryLoading,
    error: serviceHistoryError
  } = useFetch(() => api.get("/service-history"), []);

  const handleAcknowledgeAlert = async (id) => {
    await api.put(`/alerts/${id}/acknowledge`);
    refetchAlerts();
  };

  return (
    <div className="flex flex-col gap-6">
      <StateBlock loading={loading} error={error}>
        {fleetData && (
          <>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KPICard label="On Trip" value={fleetData.summary.on_trip} accent="ok" />
              <KPICard label="Idle" value={fleetData.summary.idle} accent="idle" />
              {/* Nothing reports breakdowns/maintenance yet — a 0 here would
                  claim a measurement that doesn't exist. */}
              <KPICard label="Breakdown" value={fleetData.summary.breakdown || "—"} accent="bad" />
              <KPICard label="Maintenance" value={fleetData.summary.maintenance || "—"} accent="warn" />
              <KPICard label="No Data" value={fleetData.summary.no_data} accent="info" />
              <KPICard label="Recently Active" value={fleetData.summary.recently_active} accent="accent" />
            </div>
            <div className="mt-4">
              <FleetTable fleet={fleetData.fleet} />
            </div>
          </>
        )}
      </StateBlock>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text">Alerts</h2>
        <StateBlock loading={alertsLoading} error={alertsError} empty={alerts?.length === 0} emptyLabel="No alerts">
          {alerts && <AlertFeed alerts={alerts} onAcknowledge={handleAcknowledgeAlert} />}
        </StateBlock>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text">Breakdown & Maintenance Log</h2>
        <StateBlock loading={maintenanceLoading} error={maintenanceError} empty={maintenance?.length === 0}>
          {maintenance && <MaintenanceTable records={maintenance} />}
        </StateBlock>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text">Service History</h2>
        <StateBlock
          loading={serviceHistoryLoading}
          error={serviceHistoryError}
          empty={serviceHistory?.length === 0}
          emptyLabel="No service records from VECV yet"
        >
          {serviceHistory && <ServiceHistoryTable records={serviceHistory} />}
        </StateBlock>
      </div>
    </div>
  );
}
