import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function EquipmentVolumeChart({ data }) {
  // Volume once payload is recorded; until then trips are the real measure.
  const key = data.some((d) => d.total_volume_cum > 0) ? "total_volume_cum" : "total_trips";
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ef" vertical={false} />
        <XAxis
          dataKey="vehicle_id"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#e3e8ef" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={{ stroke: "#e3e8ef" }}
          tickLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #232d3a",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
            fontSize: 12,
            color: "#0f172a"
          }}
          labelStyle={{ color: "#64748b" }}
          formatter={(value, name) =>
            name === "total_volume_cum" ? [`${value} cum`, "Volume"] : [value, "Trips"]
          }
        />
        <Bar dataKey={key} fill="#1d4ed8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
