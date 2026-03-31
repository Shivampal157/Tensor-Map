import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { EpochMetrics } from '../types';

type Row = Record<string, number | string | undefined>;

export function TrainingChart({ metrics }: { metrics: EpochMetrics[] }) {
  const data: Row[] = metrics.map((m) => ({
    epoch: m.epoch,
    loss: m.loss,
    val_loss: m.val_loss,
    accuracy: m.accuracy ?? m.mae,
    val_accuracy: m.val_accuracy ?? m.val_mae,
  }));

  if (!data.length) {
    return (
      <div className="training-panel__chart training-panel__chart--empty">
        Metrics plot here after each epoch completes.
      </div>
    );
  }

  return (
    <div className="training-panel__chart" style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="epoch" stroke="#6c757d" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" stroke="#e67e22" width={44} tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#16a085"
            width={44}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#2c3e50' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="loss"
            stroke="#e67e22"
            dot={false}
            name="loss"
            strokeWidth={2}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="val_loss"
            stroke="#d35400"
            strokeDasharray="5 5"
            dot={false}
            name="val_loss"
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="accuracy"
            stroke="#16a085"
            dot={false}
            name="accuracy / mae"
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="val_accuracy"
            stroke="#2c3e50"
            strokeDasharray="5 5"
            dot={false}
            name="val_accuracy / val_mae"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
