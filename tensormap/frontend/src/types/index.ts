export interface LayerParam {
  type: 'int' | 'float' | 'bool' | 'select' | 'string';
  default: number | boolean | string;
  min?: number;
  max?: number;
  options?: string[];
}

export interface LayerDefinition {
  keras_class: string;
  category: string;
  params: Record<string, LayerParam>;
  description: string;
}

export interface LayerNodeData {
  layerType: string;
  params: Record<string, number | boolean | string>;
  definition: LayerDefinition;
}

export interface TrainingConfig {
  epochs: number;
  batch_size: number;
  optimizer: string;
  loss: string;
  learning_rate: number;
  dataset: string;
}

export interface EpochMetrics {
  epoch: number;
  loss: number;
  accuracy?: number;
  val_loss?: number;
  val_accuracy?: number;
  mae?: number;
  val_mae?: number;
}

export interface TrainingRun {
  id: number;
  graph_id: number;
  status: 'pending' | 'running' | 'complete' | 'failed';
  config: TrainingConfig & Record<string, unknown>;
  metrics_history: EpochMetrics[];
  error_message?: string | null;
}
