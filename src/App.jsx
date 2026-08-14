import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Menu, BarChart2, Users, Home as HomeIcon, Map, ChevronRight, ChevronDown, 
  Search, Eye, EyeOff, Sliders, Maximize2, RefreshCw, LineChart as LineChartIcon,
  Layers, Filter, Calendar, Settings2
} from 'lucide-react';
import classNames from 'classnames';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Brush
} from 'recharts';
import { exportToCSV } from './utils/export';
import { generateForecastData } from './utils/forecasting';
import ProWorkspace from './components/ProWorkspace';

// Color palette for high contrast line differentiation
const PALETTE = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#d97706', // Amber
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#e11d48', // Rose
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#ea580c', // Orange
  '#7c3aed', // Violet
  '#0284c7'  // Sky
];

// Tree category mapping for clean logical grouping in sidebar
const TREE_CATEGORIES = [
  {
    id: 'pop_structure',
    title: 'Численность и возрастная структура',
    icon: Users,
    matchKeywords: ['численность', 'молодеж', 'возраст', 'населен', 'сельское']
  },
  {
    id: 'birth_death',
    title: 'Рождаемость и смертность',
    icon: BarChart2,
    matchKeywords: ['родивш', 'умерш', 'смерт', 'детей', 'рождаем', 'перинатальн']
  },
  {
    id: 'marriages_family',
    title: 'Браки, разводы и семьи',
    icon: HomeIcon,
    matchKeywords: ['брак', 'развод', 'семь', 'браке', 'первый брак']
  },
  {
    id: 'households_care',
    title: 'Домохозяйства и опека',
    icon: Layers,
    matchKeywords: ['домохозяйств', 'детские дома', 'воспитывающихся']
  },
  {
    id: 'migration',
    title: 'Миграция населения',
    icon: Map,
    matchKeywords: ['миграц', 'прибывш', 'выбывш', 'беженц']
  },
  {
    id: 'other_demo',
    title: 'Прочие демографические данные',
    icon: Filter,
    matchKeywords: []
  }
];

function App() {
  const [db, setDb] = useState(null);
  const [activeDatasetId, setActiveDatasetId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [appMode, setAppMode] = useState('standard'); // 'standard' | 'pro'
  const [expandedTreeGroups, setExpandedTreeGroups] = useState({
    pop_structure: true,
    birth_death: true,
    marriages_family: true,
    households_care: true,
    migration: true,
    other_demo: true
  });

  useEffect(() => {
    fetch('./data/db.json')
      .then(res => res.json())
      .then(data => {
        setDb(data);
        if (data.datasets && data.datasets.length > 0) {
          setActiveDatasetId(data.datasets[0].id);
        }
      })
      .catch(err => console.error("Failed to load db.json", err));
  }, []);

  if (!db) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-medium">
        <RefreshCw className="animate-spin mr-2 text-blue-600" size={20} />
        Загрузка демографических данных...
      </div>
    );
  }

  const activeDataset = db.datasets.find(d => d.id === activeDatasetId);

  // Group datasets into tree categories
  const treeGroupedDatasets = TREE_CATEGORIES.map(cat => {
    const items = db.datasets.filter(ds => {
      // Filter by search query if typed
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuery = ds.title.toLowerCase().includes(query) || ds.category.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      if (cat.id === 'other_demo') {
        // Fallback for datasets not matching prior keywords
        return !TREE_CATEGORIES.slice(0, -1).some(otherCat => 
          otherCat.matchKeywords.some(k => ds.title.toLowerCase().includes(k) || ds.category.toLowerCase().includes(k))
        );
      }
      return cat.matchKeywords.some(k => ds.title.toLowerCase().includes(k) || ds.category.toLowerCase().includes(k));
    });

    return { ...cat, items };
  }).filter(group => group.items.length > 0);

  const toggleGroup = (groupId) => {
    setExpandedTreeGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans antialiased text-slate-800">
      {appMode === 'standard' ? (
        <>
          {/* Sidebar */}
          <aside className={classNames(
            "bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-20 shadow-sm",
            isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
          )}>
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-200 bg-blue-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <Users className="text-blue-200" size={22} />
                <h1 className="text-base font-bold tracking-tight truncate">Демография Беларуси</h1>
              </div>
              <span className="text-[10px] bg-blue-700 text-blue-100 px-2 py-0.5 rounded-full font-semibold">
                {db.datasets.length} наборов
              </span>
            </div>

        {/* Sidebar Search Bar */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Поиск показателей..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tree Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          {treeGroupedDatasets.map(group => {
            const GroupIcon = group.icon;
            const isExpanded = expandedTreeGroups[group.id] || searchQuery.trim().length > 0;

            return (
              <div key={group.id} className="mb-2">
                {/* Tree Category Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors text-left group"
                >
                  <div className="flex items-center space-x-2 truncate pr-2">
                    <GroupIcon size={16} className="text-blue-600 shrink-0" />
                    <span className="truncate uppercase tracking-wider">{group.title}</span>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-full font-medium">
                      {group.items.length}
                    </span>
                    {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </div>
                </button>

                {/* Tree Items List */}
                {isExpanded && (
                  <ul className="mt-1 ml-2 pl-2 border-l border-slate-200 space-y-0.5">
                    {group.items.map(item => {
                      const isActive = activeDatasetId === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => setActiveDatasetId(item.id)}
                            className={classNames(
                              "w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-all leading-snug font-normal",
                              isActive
                                ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 pl-2 shadow-2xs"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                            )}
                            title={item.title}
                          >
                            {item.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {treeGroupedDatasets.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400">
              Показатели по запросу «{searchQuery}» не найдены
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Top Header Navbar */}
        <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 shrink-0 shadow-2xs z-10">
          <div className="flex items-center space-x-3 truncate">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 focus:outline-none transition-colors"
              title={isSidebarOpen ? "Свернуть панель" : "Развернуть панель"}
            >
              <Menu size={20} />
            </button>
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {activeDataset?.title || 'Выберите датасет'}
            </h2>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="hidden sm:inline bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md mr-2">
              Источник: <strong className="text-slate-700">{activeDataset?.source || 'Статистика'}</strong>
            </span>
            <button
              onClick={() => setAppMode('pro')}
              className="bg-slate-800 hover:bg-slate-900 text-amber-400 border border-slate-700 px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center shadow-lg uppercase tracking-wider"
            >
              <Settings2 size={14} className="mr-1.5" />
              Pro Режим
            </button>
          </div>
        </header>
        
        {/* Main Content Viewer */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeDataset && <DatasetViewer dataset={activeDataset} />}
        </div>
      </main>
        </>
      ) : (
        <div className="flex-1 flex flex-col h-full bg-slate-50">
          <header className="bg-slate-900 border-b border-slate-800 h-14 flex items-center justify-between px-4 shrink-0 shadow-lg z-20">
            <div className="flex items-center space-x-3 text-white">
              <button 
                onClick={() => setAppMode('standard')}
                className="p-1.5 rounded-md text-slate-300 hover:bg-slate-800 focus:outline-none transition-colors flex items-center font-medium text-sm"
              >
                <ChevronRight size={18} className="rotate-180 mr-1" />
                Назад
              </button>
              <div className="h-6 w-px bg-slate-700 mx-2"></div>
              <Settings2 className="text-amber-400" size={18} />
              <h2 className="text-base font-bold text-amber-400 uppercase tracking-wider">
                Pro-режим Аналитики
              </h2>
            </div>
          </header>
          <div className="flex-1 overflow-hidden">
            <ProWorkspace db={db} />
          </div>
        </div>
      )}
    </div>
  );
}

function DatasetViewer({ dataset }) {
  const { originalData } = dataset;
  
  // Extract structure dimensions
  const dims = originalData.structure.dimensions;
  const periodDim = dims.find(d => d.code === 'PERIOD');
  const otherDims = dims.filter(d => d.code !== 'PERIOD');
  
  // Default filter selections
  const defaultFilters = {};
  otherDims.forEach(d => {
    const totalItem = d.items.find(i => i.id === 'T' || i.name?.lang_ru?.toLowerCase().includes('всего') || i.name?.lang_ru?.toLowerCase().includes('оба пола'));
    defaultFilters[d.code] = totalItem ? totalItem.id : d.items[0]?.id;
  });

  const [filters, setFilters] = useState(defaultFilters);
  const [splitBy, setSplitBy] = useState('none');
  const [hiddenSeries, setHiddenSeries] = useState(new Set());
  const [hoveredSeries, setHoveredSeries] = useState(null);
  
  // Year period range state [startYearIndex, endYearIndex]
  const [yearRangeIndices, setYearRangeIndex] = useState([0, (periodDim?.items?.length || 1) - 1]);
  
  // Fix 6: Adaptive Y Scale toggle (defaults to true for clear separation of tight data)
  const [isAdaptiveY, setIsAdaptiveY] = useState(true);
  
  // Chart view mode: Line or Bar
  const [chartType, setChartType] = useState('line');

  // Forecasting and Export states
  const [forecastYears, setForecastYears] = useState(0);

  // Reset filter and view states when switching dataset
  useEffect(() => {
    setFilters(defaultFilters);
    setSplitBy('none');
    setHiddenSeries(new Set());
    setHoveredSeries(null);
    setForecastYears(0);
    if (periodDim?.items?.length) {
      setYearRangeIndex([0, periodDim.items.length - 1]);
  }, [dataset.id]);

  // Handler to automatically expand the view period to show the forecast
  const handleForecastChange = (newForecastYears) => {
    setForecastYears(newForecastYears);
    const actualDataEndIndex = (periodDim?.items?.length || 1) - 1;
    
    setYearRangeIndex(prev => {
      const [startIdx, endIdx] = prev;
      let newEndIdx = endIdx;
      
      if (newForecastYears > 0) {
        // Extend to include the forecast at the right edge
        newEndIdx = actualDataEndIndex + newForecastYears;
      } else {
        // Constrain back to actual data if forecast is disabled
        newEndIdx = Math.min(endIdx, actualDataEndIndex);
      }
      
      const newStartIdx = Math.min(startIdx, newEndIdx);
      if (startIdx === newStartIdx && endIdx === newEndIdx) return prev;
      return [newStartIdx, newEndIdx];
    });
  };

  // Handler for select dropdown change that IMMEDIATELY removes lingering focus outline
  const handleFilterSelect = (dimCode, value, event) => {
    setFilters(prev => ({ ...prev, [dimCode]: value }));
    if (event?.target) event.target.blur(); // Fix 4: Immediately blur input on selection
  };

  const handleSplitSelect = (value, event) => {
    setSplitBy(value);
    setHiddenSeries(new Set());
    if (event?.target) event.target.blur(); // Fix 4: Blur on selection
  };

  // Full dataset matrix calculation
  const fullChartData = useMemo(() => {
    if (!periodDim) return [];
    
    return periodDim.items.map(period => {
      const yearLabel = period.name?.lang_ru || period.id;
      const row = { year: yearLabel, periodId: period.id };
      
      if (splitBy !== 'none') {
        const splitDim = otherDims.find(d => d.code === splitBy);
        if (splitDim) {
          splitDim.items.forEach(splitItem => {
            const keyParts = dims.map(d => {
              if (d.code === 'PERIOD') return period.id;
              if (d.code === splitBy) return splitItem.id;
              return filters[d.code];
            });
            const key = keyParts.join(':');
            const val = originalData.dataset[key];
            if (val !== undefined && val !== null) {
              row[splitItem.name?.lang_ru || splitItem.id] = parseFloat(val);
            }
          });
        }
      } else {
        const keyParts = dims.map(d => {
          if (d.code === 'PERIOD') return period.id;
          return filters[d.code];
        });
        const key = keyParts.join(':');
        const val = originalData.dataset[key];
        if (val !== undefined && val !== null) {
          row['Значение'] = parseFloat(val);
        }
      }
      return row;
    });
  }, [dataset, filters, splitBy]);

  // Available year periods
  const yearsList = useMemo(() => {
    return periodDim ? periodDim.items.map(p => p.name?.lang_ru || p.id) : [];
  }, [periodDim]);

  // Filter chart data according to year range slider
  const visibleChartDataRaw = useMemo(() => {
    const [startIdx, endIdx] = yearRangeIndices;
    return fullChartData.slice(startIdx, endIdx + 1);
  }, [fullChartData, yearRangeIndices]);

  // Active series line keys
  const lines = useMemo(() => {
    if (fullChartData.length === 0) return [];
    const keys = new Set();
    fullChartData.forEach(row => {
      Object.keys(row).forEach(k => {
        if (k !== 'year' && k !== 'periodId') keys.add(k);
      });
    });
    return Array.from(keys);
  }, [fullChartData]);

  // Apply forecasting if enabled to the full dataset (not just the sliced visible one)
  const forecastedChartData = useMemo(() => {
    if (forecastYears > 0) {
      const activeLines = lines.filter(l => !hiddenSeries.has(l));
      return generateForecastData(fullChartData, activeLines, forecastYears);
    }
    return fullChartData;
  }, [fullChartData, lines, hiddenSeries, forecastYears]);

  // Filter chart data according to year range slider ONLY for the raw table
  const visibleChartData = useMemo(() => {
    const [startIdx, endIdx] = yearRangeIndices;
    return forecastedChartData.slice(startIdx, endIdx + 1);
  }, [forecastedChartData, yearRangeIndices]);

  // Fix 6: Calculate Min/Max values across visible dataset to determine optimal Y-axis bounds
  const yDomainLimits = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    visibleChartData.forEach(row => {
      lines.forEach(lineKey => {
        if (!hiddenSeries.has(lineKey) && row[lineKey] !== undefined && !isNaN(row[lineKey])) {
          if (row[lineKey] < min) min = row[lineKey];
          if (row[lineKey] > max) max = row[lineKey];
        }
      });
    });

    if (min === Infinity || max === -Infinity) return [0, 'auto'];

    if (isAdaptiveY) {
      const padding = (max - min) * 0.08 || min * 0.05 || 1;
      const calculatedMin = Math.max(0, Math.floor(min - padding));
      const calculatedMax = Math.ceil(max + padding);
      return [calculatedMin, calculatedMax];
    } else {
      return [0, 'auto'];
    }
  }, [visibleChartData, lines, hiddenSeries, isAdaptiveY]);

  // Toggle hiding/showing a series on legend click (Fix 2)
  const toggleSeries = (lineKey) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(lineKey)) {
        next.delete(lineKey);
      } else {
        // Don't allow hiding all series
        if (next.size < lines.length - 1) {
          next.add(lineKey);
        }
      }
      return next;
    });
  };

  // Quick preset year range buttons (Fix 5)
  const setQuickPeriodPreset = (yearsCount) => {
    if (!yearsList.length) return;
    const total = yearsList.length;
    if (yearsCount === 'all') {
      setYearRangeIndex([0, total - 1]);
    } else {
      const start = Math.max(0, total - yearsCount);
      setYearRangeIndex([start, total - 1]);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Dataset Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-xl shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">{dataset.title}</h3>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Раздел: <span className="font-semibold text-slate-700">{dataset.category}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Chart type toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setChartType('line')}
                className={classNames(
                  "px-2.5 py-1 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition-all",
                  chartType === 'line' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <LineChartIcon size={14} />
                <span>Линии</span>
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={classNames(
                  "px-2.5 py-1 text-xs font-semibold rounded-md flex items-center space-x-1.5 transition-all",
                  chartType === 'bar' ? "bg-white text-blue-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <BarChart2 size={14} />
                <span>Столбцы</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters Controls Panel */}
        {otherDims.length > 0 && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 flex flex-wrap gap-4 items-end">
            {otherDims.map(dim => (
              <div key={dim.code} className="flex flex-col min-w-[180px] flex-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {dim.name?.lang_ru || dim.code}
                </label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer transition-all shadow-2xs hover:border-slate-400"
                  value={filters[dim.code]}
                  onChange={e => handleFilterSelect(dim.code, e.target.value, e)}
                  onFocus={e => e.target.blur()} // Fix 4: Prevent focus outline retention
                  disabled={splitBy === dim.code}
                >
                  {dim.items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name?.lang_ru || item.id}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            
            {/* Split by Dimension dropdown */}
            <div className="flex flex-col min-w-[200px] flex-1 border-l sm:border-l border-slate-300 sm:pl-4 pl-0 pt-2 sm:pt-0">
              <label className="text-[11px] font-extrabold text-blue-700 uppercase tracking-wider mb-1.5 flex items-center">
                <Layers size={13} className="mr-1" />
                Разбить график по:
              </label>
              <select 
                className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-xs bg-blue-50/80 text-blue-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-2xs hover:bg-blue-100/80 transition-all"
                value={splitBy}
                onChange={e => handleSplitSelect(e.target.value, e)}
                onFocus={e => e.target.blur()} // Fix 4: Prevent focus outline retention
              >
                <option value="none">Не разбивать (Одна линия)</option>
                {otherDims.map(dim => (
                  <option key={dim.code} value={dim.code}>
                    {dim.name?.lang_ru || dim.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Chart View Toolbar: Adaptive Scale Toggle + Period Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200/80 text-xs">
          {/* Fix 6: Adaptive Y Scale toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAdaptiveY(!isAdaptiveY)}
              className={classNames(
                "px-2.5 py-1 rounded-md font-medium text-xs flex items-center space-x-1.5 transition-all border shadow-2xs",
                isAdaptiveY 
                  ? "bg-blue-600 text-white border-blue-600 font-semibold" 
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              )}
              title="Адаптирует масштаб оси Y под диапазон данных, чтобы различия между близкими линиями были четко видны"
            >
              <Sliders size={13} />
              <span>Адаптивная шкала Y: <strong>{isAdaptiveY ? 'Вкл (по фокусу)' : 'От 0'}</strong></span>
            </button>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              (помогает разделить близкие значения)
            </span>
          </div>

          {/* Fix 5: Period quick preset buttons */}
          {yearsList.length > 3 && (
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 font-medium mr-1 flex items-center">
                <Calendar size={13} className="mr-1" /> Период:
              </span>
              <button
                onClick={() => setQuickPeriodPreset('all')}
                className={classNames(
                  "px-2 py-0.5 rounded text-[11px] font-medium transition-colors border",
                  yearRangeIndices[0] === 0 && yearRangeIndices[1] === yearsList.length - 1
                    ? "bg-blue-100 text-blue-700 border-blue-300 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                Все ({yearsList.length} лет)
              </button>
              {yearsList.length >= 5 && (
                <button
                  onClick={() => setQuickPeriodPreset(5)}
                  className={classNames(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-colors border",
                    yearRangeIndices[1] - yearRangeIndices[0] + 1 === 5 && yearRangeIndices[1] === yearsList.length - 1
                      ? "bg-blue-100 text-blue-700 border-blue-300 font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  Последние 5 лет
                </button>
              )}
              {yearsList.length >= 10 && (
                <button
                  onClick={() => setQuickPeriodPreset(10)}
                  className={classNames(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-colors border",
                    yearRangeIndices[1] - yearRangeIndices[0] + 1 === 10 && yearRangeIndices[1] === yearsList.length - 1
                      ? "bg-blue-100 text-blue-700 border-blue-300 font-bold"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  10 лет
                </button>
              )}
            </div>
          )}

          {/* Forecast UI Controls */}
          <div className="flex items-center space-x-3 border-l border-slate-300 pl-3 ml-1 bg-slate-50 px-3 py-1 rounded-md">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none mb-1">
                Тренд (Регрессия)
              </span>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={forecastYears > 0}
                  onChange={(e) => {
                    handleForecastChange(e.target.checked ? 5 : 0);
                  }}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-white border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-700">Прогноз</span>
              </label>
            </div>
            
            {forecastYears > 0 && (
              <div className="flex items-center space-x-2 ml-2 border-l border-slate-200 pl-3">
                <input 
                  type="range" 
                  min="1" max="10" step="1"
                  value={forecastYears}
                  onChange={(e) => handleForecastChange(Number(e.target.value))}
                  className="w-24 accent-amber-500"
                />
                <span className="text-xs font-bold text-amber-600 w-12">{forecastYears} {forecastYears === 1 ? 'год' : forecastYears < 5 ? 'года' : 'лет'}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Interactive Chart Area (Fix 1: Focus outline removed) */}
        {visibleChartData.length > 0 && lines.length > 0 ? (
          <div className="space-y-4">
            <div 
              tabIndex={-1} 
              className="h-[430px] w-full mt-2 outline-none focus:outline-none focus:ring-0 select-none"
            >
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart 
                    data={forecastedChartData} 
                    margin={{ top: 15, right: 45, left: 15, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="year" 
                      tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} 
                      tickLine={false} 
                      axisLine={{stroke: '#cbd5e1'}} 
                    />
                    <YAxis 
                      tick={{fill: '#64748b', fontSize: 12}} 
                      tickLine={false} 
                      axisLine={false} 
                      width={75}
                      domain={yDomainLimits}
                      tickFormatter={val => new Intl.NumberFormat('ru-RU', { notation: "compact", compactDisplay: "short" }).format(val)}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {lines.map((key, i) => {
                      const isHidden = hiddenSeries.has(key);
                      const isHovered = hoveredSeries === key;
                      const hasHover = hoveredSeries !== null;

                      if (isHidden) return null;

                      const strokeColor = PALETTE[i % PALETTE.length];
                      const opacity = hasHover ? (isHovered ? 1.0 : 0.18) : 1.0;
                      const strokeWidth = isHovered ? 4.5 : 2.8;

                      return (
                        <Line 
                          key={key} 
                          type="monotone" 
                          dataKey={key} 
                          stroke={strokeColor} 
                          strokeWidth={strokeWidth}
                          strokeOpacity={opacity}
                          strokeDasharray={row => row?.isForecast ? "5 5" : "0"}
                          dot={(props) => {
                            const { cx, cy, payload } = props;
                            if (payload.isForecast) {
                              return <circle cx={cx} cy={cy} r={3} fill="#fff" stroke={strokeColor} strokeWidth={2} strokeDasharray="0" />;
                            }
                            return <circle cx={cx} cy={cy} r={isHovered ? 6 : 3.5} fill={strokeColor} stroke="#fff" strokeWidth={1} />;
                          }}
                          activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                          connectNulls={true}
                          onMouseEnter={() => setHoveredSeries(key)}
                          onMouseLeave={() => setHoveredSeries(null)}
                        />
                      );
                    })}

                    {/* Fix 5: Interactive period Brush slider directly under the chart */}
                    {yearsList.length > 2 && (
                      <Brush 
                        dataKey="year" 
                        height={28} 
                        stroke="#3b82f6"
                        fill="#f8fafc"
                        startIndex={yearRangeIndices[0]}
                        endIndex={yearRangeIndices[1]}
                        onChange={(e) => {
                          if (e && typeof e.startIndex === 'number' && typeof e.endIndex === 'number') {
                            setYearRangeIndex([e.startIndex, e.endIndex]);
                          }
                        }}
                      />
                    )}
                  </LineChart>
                ) : (
                  <BarChart 
                    data={forecastedChartData} 
                    margin={{ top: 15, right: 45, left: 15, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="year" 
                      tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} 
                      tickLine={false} 
                      axisLine={{stroke: '#cbd5e1'}} 
                    />
                    <YAxis 
                      tick={{fill: '#64748b', fontSize: 12}} 
                      tickLine={false} 
                      axisLine={false} 
                      width={75}
                      domain={yDomainLimits}
                      tickFormatter={val => new Intl.NumberFormat('ru-RU', { notation: "compact", compactDisplay: "short" }).format(val)}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {lines.map((key, i) => {
                      const isHidden = hiddenSeries.has(key);
                      const isHovered = hoveredSeries === key;
                      const hasHover = hoveredSeries !== null;

                      if (isHidden) return null;

                      const fillColor = PALETTE[i % PALETTE.length];
                      const opacity = hasHover ? (isHovered ? 1.0 : 0.2) : 0.85;

                      return (
                        <Bar 
                          key={key} 
                          dataKey={key} 
                          fill={fillColor}
                          fillOpacity={opacity}
                          radius={[4, 4, 0, 0]}
                          onMouseEnter={() => setHoveredSeries(key)}
                          onMouseLeave={() => setHoveredSeries(null)}
                        />
                      );
                    })}

                    {yearsList.length > 2 && (
                      <Brush 
                        dataKey="year" 
                        height={28} 
                        stroke="#3b82f6"
                        fill="#f8fafc"
                        startIndex={yearRangeIndices[0]}
                        endIndex={yearRangeIndices[1]}
                        onChange={(e) => {
                          if (e && typeof e.startIndex === 'number' && typeof e.endIndex === 'number') {
                            setYearRangeIndex([e.startIndex, e.endIndex]);
                          }
                        }}
                      />
                    )}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Fix 2: Interactive Legend with Click-to-Exclude / Toggle functionality */}
            <div className="flex flex-wrap justify-center items-center gap-2 pt-2 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Легенда (клик — скрыть):
              </span>
              {lines.map((lineKey, i) => {
                const isHidden = hiddenSeries.has(lineKey);
                const isHovered = hoveredSeries === lineKey;
                const color = PALETTE[i % PALETTE.length];

                return (
                  <button
                    key={lineKey}
                    onClick={() => toggleSeries(lineKey)}
                    onMouseEnter={() => setHoveredSeries(lineKey)}
                    onMouseLeave={() => setHoveredSeries(null)}
                    className={classNames(
                      "flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all select-none cursor-pointer",
                      isHidden 
                        ? "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60" 
                        : isHovered
                          ? "bg-white text-slate-900 shadow-sm border-blue-400 ring-2 ring-blue-100 font-semibold scale-105"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50"
                    )}
                    title={isHidden ? "Показать категорию на графике" : "Исключить категорию из графика"}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform" 
                      style={{ 
                        backgroundColor: isHidden ? '#cbd5e1' : color,
                        transform: isHovered ? 'scale(1.3)' : 'scale(1)'
                      }} 
                    />
                    <span className="truncate max-w-[220px]">{lineKey}</span>
                    {isHidden ? <EyeOff size={12} className="text-slate-400 ml-1" /> : <Eye size={12} className="text-slate-300 hover:text-slate-500 ml-1 opacity-0 hover:opacity-100 transition-opacity" />}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center bg-slate-50 rounded-xl text-slate-400 border border-dashed border-slate-300 p-6 text-center">
            <Filter size={32} className="text-slate-300 mb-2" />
            <p className="font-medium text-sm text-slate-600">Нет данных для выбранной комбинации фильтров</p>
            <p className="text-xs text-slate-400 mt-1">Попробуйте выбрать другой регион, категорию или сбросить скрытые линии</p>
          </div>
        )}
      </div>

      {/* Raw Data Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
            <BarChart2 size={16} className="text-blue-600" />
            <span>Данные в табличном виде ({visibleChartData.length} периодов)</span>
          </h3>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-500 hidden sm:inline">
              Отображаются выбранные периоды и категории
            </span>
            <button
              onClick={() => {
                const activeLines = lines.filter(l => !hiddenSeries.has(l));
                exportToCSV(visibleChartData, ['year', ...activeLines], dataset.title.replace(/\s+/g, '_'));
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center shadow-2xs"
            >
              Экспорт CSV
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                  Год / Период
                </th>
                {lines.map((line, i) => {
                  const isHidden = hiddenSeries.has(line);
                  if (isHidden) return null;
                  return (
                    <th key={line} className="px-5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        <span>{line}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {visibleChartData.map((row, idx) => {
                const activeLines = lines.filter(l => !hiddenSeries.has(l));
                const hasData = activeLines.some(line => row[line] !== undefined && row[line] !== null);
                if (!hasData) return null;

                return (
                  <tr key={idx} className={classNames("hover:bg-blue-50/40 transition-colors", row.isForecast && "bg-amber-50/50")}>
                    <td className="px-5 py-3 whitespace-nowrap font-bold text-slate-900 bg-slate-50/50 flex items-center space-x-2">
                      <span>{row.year}</span>
                      {row.isForecast && <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded uppercase font-bold">Прогноз</span>}
                    </td>
                    {lines.map(line => {
                      if (hiddenSeries.has(line)) return null;
                      const val = row[line];
                      return (
                        <td key={line} className="px-5 py-3 whitespace-nowrap text-slate-700 font-medium">
                          {val !== undefined && val !== null ? new Intl.NumberFormat('ru-RU').format(val) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip component for rich legible display of line values
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  // Sort payload values descending
  const sortedPayload = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
    <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs backdrop-blur-md min-w-[200px]">
      <div className="font-bold border-b border-slate-700 pb-1.5 mb-2 text-blue-300 text-sm flex items-center justify-between">
        <span>Период: {label} г.</span>
        <span className="text-[10px] text-slate-400 font-normal">{payload.length} показателей</span>
      </div>
      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
        {sortedPayload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-300 truncate max-w-[180px]">{entry.name}:</span>
            </div>
            <span className="font-bold font-mono text-white text-right">
              {new Intl.NumberFormat('ru-RU').format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
