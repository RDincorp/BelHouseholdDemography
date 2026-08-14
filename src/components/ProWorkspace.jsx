import React, { useState, useMemo } from 'react';
import { 
  Plus, X, Settings2, BarChart2, Layers, Download, Search, ChevronDown, ChevronRight
} from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { exportToCSV } from '../utils/export';
import { getConstantColor } from '../utils/colors';

export default function ProWorkspace({ db, treeGroupedDatasets }) {
  const [layers, setLayers] = useState([]);
  const [layerIdCounter, setLayerIdCounter] = useState(1);
  const [collapsedLayers, setCollapsedLayers] = useState({});
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [collapsedCatalogGroups, setCollapsedCatalogGroups] = useState({});

  // Add a new empty layer
  // Add a new empty layer from catalog
  const addLayer = (datasetId) => {
    setLayers([...layers, {
      id: layerIdCounter,
      datasetId: datasetId,
      filters: {},
      yAxisId: 'left', // left or right
      type: 'line', // line or bar
      name: db.datasets.find(d => d.id === datasetId)?.title || `Слой ${layerIdCounter}`
    }]);
    setLayerIdCounter(prev => prev + 1);
  };

  const removeLayer = (id) => {
    setLayers(layers.filter(l => l.id !== id));
  };

  const updateLayer = (id, updates) => {
    setLayers(layers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const toggleLayerCollapse = (id) => {
    setCollapsedLayers(prev => ({ ...prev, [id]: !prev[id] }));
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
    <div className="flex h-full overflow-hidden bg-slate-100 relative">
      {/* Layers Panel (Left) */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 shadow-xl flex flex-col z-10 shrink-0 h-full overflow-y-auto">
        <div className="p-4 border-b border-slate-800 bg-slate-900/95 text-white flex justify-between items-center sticky top-0 z-20 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <Layers size={20} className="text-amber-400" />
            <h2 className="font-bold tracking-wide uppercase text-sm">Слои данных</h2>
          </div>
          <button 
            onClick={() => setIsCatalogOpen(true)}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md transition-colors border border-slate-700 hover:border-slate-600 shadow-xs"
            title="Добавить показатель"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {layers.length === 0 ? (
            <div className="text-center p-8 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/50">
              <Layers size={32} className="mx-auto mb-3 text-slate-600" />
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
                isCollapsed={collapsedLayers[layer.id]}
                onToggleCollapse={() => toggleLayerCollapse(layer.id)}
                color={getConstantColor(layer.name)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main Chart Area (Right) */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full min-h-[500px]">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Мульти-анализ показателей</h2>
              <p className="text-slate-500 text-sm mt-1">Сравнение различных наборов данных на единой временной шкале</p>
            </div>
            {chartData.length > 0 && (
              <button 
                onClick={() => {
                  const exportKeys = layers.map(l => `Layer_${l.id}`);
                  exportToCSV(chartData, ['year', ...exportKeys], 'pro_analysis');
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center shadow-sm"
              >
                <Download size={16} className="mr-2" />
                Экспорт CSV
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
                    const color = getConstantColor(layer.name);
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
               <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl text-slate-400 border-2 border-dashed border-slate-200">
                  <BarChart2 size={64} className="text-slate-200 mb-4" />
                  <p className="text-lg font-medium text-slate-500">Нет слоев для отображения графика</p>
                  <p className="text-sm mt-2 text-slate-400 max-w-sm text-center">Добавьте нужные показатели на панели слева, чтобы начать перекрестный анализ данных</p>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Catalog Modal */}
      {isCatalogOpen && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Layers className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Каталог данных</h3>
                  <p className="text-sm text-slate-500">Выберите показатель для добавления на график</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCatalogOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Search */}
            <div className="p-4 border-b border-slate-100 bg-white shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Поиск по показателям..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium text-slate-700"
                />
              </div>
            </div>

            {/* List with Categories */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-6">
              {treeGroupedDatasets.map(group => {
                const GroupIcon = group.icon;
                // Filter items within the group by search
                const filteredItems = group.items.filter(ds => 
                  ds.title.toLowerCase().includes(catalogSearch.toLowerCase())
                );
                
                if (filteredItems.length === 0) return null;
                const isGroupCollapsed = collapsedCatalogGroups[group.id] ?? true; // Collapsed by default

                return (
                  <div key={group.id} className="mb-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <button 
                      onClick={() => setCollapsedCatalogGroups(prev => ({...prev, [group.id]: !isGroupCollapsed}))}
                      className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <GroupIcon size={18} className="text-blue-500" />
                        <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{group.title}</span>
                      </div>
                      {isGroupCollapsed ? <ChevronRight size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>
                    
                    {!isGroupCollapsed && (
                      <div className="p-2 space-y-1 bg-white">
                        {filteredItems.map(ds => {
                          const addedLayer = layers.find(l => l.datasetId === ds.id);
                          const isAdded = !!addedLayer;
                          return (
                            <button
                              key={ds.id}
                              onClick={() => {
                                if (isAdded) {
                                  removeLayer(addedLayer.id);
                                } else {
                                  addLayer(ds.id);
                                }
                              }}
                              className={`w-full text-left p-3 rounded-xl transition-all border group flex items-start justify-between ${
                                isAdded 
                                  ? 'bg-emerald-50/50 border-emerald-200/50 hover:border-emerald-300 hover:bg-emerald-50' 
                                  : 'bg-white border-transparent hover:border-slate-200 hover:shadow-xs hover:bg-slate-50'
                              }`}
                            >
                              <div className="pr-4">
                                <h5 className={`font-bold transition-colors leading-snug ${isAdded ? 'text-emerald-800' : 'text-slate-800 group-hover:text-blue-600'}`}>{ds.title}</h5>
                                <p className={`text-[11px] mt-1 uppercase tracking-wider ${isAdded ? 'text-emerald-600/70' : 'text-slate-400'}`}>{ds.source}</p>
                              </div>
                              {isAdded ? (
                                <div className="text-emerald-600 shrink-0 mt-1 flex flex-col items-center bg-emerald-100 px-2 py-1 rounded transition-colors group-hover:bg-red-100 group-hover:text-red-600" title="Удалить из выбранного">
                                  <X size={20} />
                                </div>
                              ) : (
                                <Plus className="text-slate-300 group-hover:text-blue-500 shrink-0 mt-1" size={20} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {treeGroupedDatasets.every(group => 
                group.items.filter(ds => ds.title.toLowerCase().includes(catalogSearch.toLowerCase())).length === 0
              ) && (
                <div className="text-center py-12 text-slate-400">
                  Ничего не найдено по вашему запросу.
                </div>
              )}
            </div>

            {/* Footer with Done Button */}
            <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex justify-end">
               <button 
                  onClick={() => setIsCatalogOpen(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-md hover:shadow-lg"
               >
                 Готово
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LayerConfigCard({ layer, db, onUpdate, onRemove, isCollapsed, onToggleCollapse, color }) {
  const dataset = db.datasets.find(d => d.id === layer.datasetId);
  const dims = dataset ? dataset.originalData.structure.dimensions.filter(d => d.code !== 'PERIOD') : [];

  return (
    <div className={`border border-slate-700 rounded-xl overflow-hidden bg-slate-800 shadow-lg transition-all duration-200 ${isCollapsed ? 'opacity-80 hover:opacity-100' : ''}`}>
      <div 
        className="p-2.5 text-xs font-bold text-white flex justify-between items-center relative cursor-pointer group select-none"
        style={{ backgroundColor: color }}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center space-x-2 truncate pr-2 w-full">
          {isCollapsed ? <ChevronRight size={16} className="opacity-70" /> : <ChevronDown size={16} className="opacity-70" />}
          <input 
            type="text" 
            value={layer.name} 
            onChange={(e) => onUpdate({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()} // prevent collapsing when editing name
            className="bg-black/10 hover:bg-black/20 focus:bg-black/40 px-2 py-1 rounded outline-none border-none text-white placeholder:text-white/60 font-bold truncate w-full transition-colors cursor-text"
          />
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }} 
          className="p-1.5 hover:bg-black/20 rounded-md z-10 shrink-0 transition-colors ml-2 opacity-0 group-hover:opacity-100"
          title="Удалить слой"
        >
          <X size={16} />
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="p-4 space-y-4">
          <div className="text-xs font-bold text-slate-300 leading-snug mb-2 border-b border-slate-700/50 pb-2">
            {db.datasets.find(d => d.id === layer.datasetId)?.title}
          </div>


        {dims.map(dim => (
          <div key={dim.code}>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 truncate" title={dim.name?.lang_ru || dim.code}>
              {dim.name?.lang_ru || dim.code}
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none truncate transition-shadow"
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

        <div className="border-t border-slate-700/50 pt-3 mt-4 flex space-x-2">
           <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Привязка оси Y</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none transition-shadow"
                value={layer.yAxisId}
                onChange={e => onUpdate({ yAxisId: e.target.value })}
              >
                <option value="left">Левая (Млн / Базовая)</option>
                <option value="right">Правая (Тыс / Проценты)</option>
              </select>
           </div>
        </div>
        </div>
      )}
    </div>
  );
}
