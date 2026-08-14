import React, { useState, useMemo } from 'react';
import { 
  Plus, X, Settings2, BarChart2, Layers, Download
} from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { exportToCSV } from '../utils/export';

const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#e11d48'];

export default function ProWorkspace({ db }) {
  const [layers, setLayers] = useState([]);
  const [layerIdCounter, setLayerIdCounter] = useState(1);

  // Add a new empty layer
  const addLayer = () => {
    setLayers([...layers, {
      id: layerIdCounter,
      datasetId: db.datasets[0].id,
      filters: {},
      yAxisId: 'left', // left or right
      type: 'line', // line or bar
      name: `Слой ${layerIdCounter}`
    }]);
    setLayerIdCounter(prev => prev + 1);
  };

  const removeLayer = (id) => {
    setLayers(layers.filter(l => l.id !== id));
  };

  const updateLayer = (id, updates) => {
    setLayers(layers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  // Compile data from all layers into a single time series
  const chartData = useMemo(() => {
    if (layers.length === 0) return [];
    
    const yearMap = {};

    layers.forEach((layer, layerIndex) => {
      const dataset = db.datasets.find(d => d.id === layer.datasetId);
      if (!dataset) return;

      const { originalData } = dataset;
      const dims = originalData.structure.dimensions;
      const periodDim = dims.find(d => d.code === 'PERIOD');
      if (!periodDim) return;

      // Ensure layer has default filters if not set
      const currentFilters = { ...layer.filters };
      dims.forEach(d => {
        if (d.code !== 'PERIOD' && !currentFilters[d.code]) {
          const totalItem = d.items.find(i => i.id === 'T' || i.name?.lang_ru?.toLowerCase().includes('всего') || i.name?.lang_ru?.toLowerCase().includes('оба пола'));
          currentFilters[d.code] = totalItem ? totalItem.id : d.items[0]?.id;
        }
      });

      // Extract time series for this layer
      periodDim.items.forEach(period => {
        const year = period.name?.lang_ru || period.id;
        
        const keyParts = dims.map(d => {
          if (d.code === 'PERIOD') return period.id;
          return currentFilters[d.code];
        });
        const key = keyParts.join(':');
        const val = originalData.dataset[key];
        
        if (val !== undefined && val !== null) {
          if (!yearMap[year]) yearMap[year] = { year, numericYear: parseInt(year, 10) };
          yearMap[year][`Layer_${layer.id}`] = parseFloat(val);
        }
      });
    });

    // Convert map to sorted array
    return Object.values(yearMap).sort((a, b) => a.numericYear - b.numericYear);
  }, [layers, db]);

  // Determine active keys
  const dataKeys = layers.map(l => `Layer_${l.id}`);
  
  // Custom Legend formatter
  const renderLegend = (value, entry) => {
    const layerId = parseInt(value.replace('Layer_', ''), 10);
    const layer = layers.find(l => l.id === layerId);
    return <span className="text-sm font-semibold ml-1">{layer ? layer.name : value}</span>;
  };

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 relative">
      {/* Layers Panel (Left) */}
      <div className="w-80 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 shrink-0 h-full overflow-y-auto">
        <div className="p-4 border-b border-slate-200 bg-slate-800 text-white flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center space-x-2">
            <Settings2 size={20} className="text-blue-400" />
            <h2 className="font-bold">Слои данных</h2>
          </div>
          <button 
            onClick={addLayer}
            className="p-1 hover:bg-slate-700 rounded-md transition-colors"
            title="Добавить показатель"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {layers.length === 0 ? (
            <div className="text-center p-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
              <Layers size={32} className="mx-auto mb-2 text-slate-300" />
              Добавьте первый слой для построения графика
            </div>
          ) : (
            layers.map((layer, idx) => (
              <LayerConfigCard 
                key={layer.id} 
                layer={layer} 
                db={db} 
                onUpdate={(updates) => updateLayer(layer.id, updates)}
                onRemove={() => removeLayer(layer.id)}
                color={PALETTE[idx % PALETTE.length]}
              />
            ))
          )}
        </div>
      </div>

      {/* Main Chart Area (Right) */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col h-full min-h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Профессиональный анализ</h2>
              <p className="text-slate-500 text-sm">Сравнение показателей из разных разделов (Наложение слоев)</p>
            </div>
            {chartData.length > 0 && (
              <button 
                onClick={() => {
                  const exportKeys = layers.map(l => `Layer_${l.id}`);
                  exportToCSV(chartData, ['year', ...exportKeys], 'pro_analysis');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center shadow-2xs border border-slate-200"
              >
                <Download size={14} className="mr-1.5" />
                Экспорт
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 w-full" tabIndex={-1}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={{stroke: '#cbd5e1'}} />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    tick={{fill: '#64748b', fontSize: 12}} 
                    tickLine={false} 
                    axisLine={false} 
                    width={70}
                    tickFormatter={val => new Intl.NumberFormat('ru-RU', { notation: "compact" }).format(val)}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{fill: '#64748b', fontSize: 12}} 
                    tickLine={false} 
                    axisLine={false} 
                    width={70}
                    tickFormatter={val => new Intl.NumberFormat('ru-RU', { notation: "compact" }).format(val)}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: '1px solid #334155', backgroundColor: 'rgba(15, 23, 42, 0.95)', color: 'white', fontSize: '12px', backdropFilter: 'blur(8px)'}}
                    formatter={(value, name) => {
                      const layerId = parseInt(name.replace('Layer_', ''), 10);
                      const layer = layers.find(l => l.id === layerId);
                      return [new Intl.NumberFormat('ru-RU').format(value), layer ? layer.name : name];
                    }}
                    labelStyle={{color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '4px'}}
                  />
                  <Legend formatter={renderLegend} iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                  
                  {layers.map((layer, idx) => {
                    const color = PALETTE[idx % PALETTE.length];
                    const dataKey = `Layer_${layer.id}`;
                    
                    return (
                      <Line
                        key={layer.id}
                        yAxisId={layer.yAxisId}
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 1, stroke: '#fff', fill: color }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                        connectNulls
                      />
                    );
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 border border-dashed border-slate-300">
                  <div className="text-center">
                    <BarChart2 size={48} className="mx-auto text-slate-200 mb-3" />
                    <p>Нет данных для отображения</p>
                    <p className="text-xs mt-1 text-slate-400">Добавьте слои на панели слева</p>
                  </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LayerConfigCard({ layer, db, onUpdate, onRemove, color }) {
  const dataset = db.datasets.find(d => d.id === layer.datasetId);
  const dims = dataset ? dataset.originalData.structure.dimensions.filter(d => d.code !== 'PERIOD') : [];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
      <div 
        className="p-2 text-xs font-bold text-white flex justify-between items-center relative"
        style={{ backgroundColor: color }}
      >
        <div className="flex items-center space-x-2 truncate pr-2">
          <input 
            type="text" 
            value={layer.name} 
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="bg-black/20 hover:bg-black/30 px-2 py-0.5 rounded outline-none border-none text-white placeholder:text-white/60 font-semibold truncate max-w-[150px]"
          />
        </div>
        <button onClick={onRemove} className="p-1 hover:bg-black/20 rounded z-10 shrink-0">
          <X size={14} />
        </button>
      </div>
      
      <div className="p-3 bg-slate-50 space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Показатель</label>
          <select 
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none truncate"
            value={layer.datasetId}
            onChange={e => {
              const newDatasetId = e.target.value;
              // Reset filters when dataset changes to prevent invalid selections
              onUpdate({ datasetId: newDatasetId, filters: {}, name: db.datasets.find(d => d.id === newDatasetId)?.title || layer.name });
            }}
          >
            {db.datasets.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.title}</option>
            ))}
          </select>
        </div>

        {dims.map(dim => (
          <div key={dim.code}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate" title={dim.name?.lang_ru || dim.code}>
              {dim.name?.lang_ru || dim.code}
            </label>
            <select
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none truncate"
              value={layer.filters[dim.code] || ''}
              onChange={e => {
                onUpdate({ filters: { ...layer.filters, [dim.code]: e.target.value } });
              }}
            >
              <option value="" disabled>--- Выберите ---</option>
              {dim.items.map(item => (
                <option key={item.id} value={item.id}>{item.name?.lang_ru || item.id}</option>
              ))}
            </select>
          </div>
        ))}

        <div className="border-t border-slate-200 pt-2 flex space-x-2">
           <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ось Y</label>
              <select 
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                value={layer.yAxisId}
                onChange={e => onUpdate({ yAxisId: e.target.value })}
              >
                <option value="left">Левая (Млн / Базовая)</option>
                <option value="right">Правая (Тыс / Проценты)</option>
              </select>
           </div>
        </div>
      </div>
    </div>
  );
}
