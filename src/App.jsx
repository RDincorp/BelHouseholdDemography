import React, { useState, useEffect, useMemo } from 'react';
import { Menu, BarChart2, Users, Home as HomeIcon, Map, ChevronRight } from 'lucide-react';
import classNames from 'classnames';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';

function App() {
  const [db, setDb] = useState(null);
  const [activeDatasetId, setActiveDatasetId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    fetch('./data/db.json')
      .then(res => res.json())
      .then(data => {
        setDb(data);
        if (data.datasets && data.datasets.length > 0) {
          setActiveDatasetId(data.datasets[0].id);
        }
      });
  }, []);

  if (!db) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Загрузка данных...</div>;
  }

  const activeDataset = db.datasets.find(d => d.id === activeDatasetId);

  // Group datasets by category
  const categories = db.datasets.reduce((acc, dataset) => {
    if (!acc[dataset.category]) acc[dataset.category] = [];
    acc[dataset.category].push(dataset);
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={classNames(
        "bg-white border-r border-gray-200 flex flex-col transition-all duration-300",
        isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
      )}>
        <div className="p-4 border-b border-gray-200 bg-blue-600 text-white flex items-center justify-between">
          <h1 className="text-lg font-bold whitespace-nowrap overflow-hidden">Демография РБ</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          {Object.entries(categories).map(([category, items]) => (
            <div key={category} className="mb-6">
              <div className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {category}
              </div>
              <ul>
                {items.map(item => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveDatasetId(item.id)}
                      className={classNames(
                        "w-full text-left px-4 py-2 text-sm transition-colors",
                        activeDatasetId === item.id 
                          ? "bg-blue-50 text-blue-700 font-medium border-r-4 border-blue-600" 
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 mr-4 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-medium text-gray-800 truncate">
            {activeDataset?.title || 'Выберите датасет'}
          </h2>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6">
          {activeDataset && <DatasetViewer dataset={activeDataset} />}
        </div>
      </main>
    </div>
  );
}

function DatasetViewer({ dataset }) {
  const { originalData } = dataset;
  
  // Parse dimensions
  const dims = originalData.structure.dimensions;
  
  // Let's find the time dimension (usually PERIOD)
  const periodDim = dims.find(d => d.code === 'PERIOD');
  const sexDim = dims.find(d => d.code === 'SEX');
  
  // Transform dataset values into a chartable format
  const chartData = useMemo(() => {
    if (!periodDim) return [];
    
    // Default chart: plot total population over time
    return periodDim.items.map(period => {
      const row = { year: period.name.lang_ru || period.id };
      
      if (sexDim) {
        // If sex dim exists, plot by sex
        sexDim.items.forEach(sex => {
           // Find key that matches this period and sex, with totals for other dims
           const keyParts = dims.map(d => {
             if (d.code === 'PERIOD') return period.id;
             if (d.code === 'SEX') return sex.id;
             return 'T'; // 'T' usually stands for Total in SDMX-like structures
           });
           const key = keyParts.join(':');
           const val = originalData.dataset[key];
           if (val) row[sex.name.lang_ru || sex.id] = parseFloat(val);
        });
      } else {
        // Just find total for this period
        const keyParts = dims.map(d => {
           if (d.code === 'PERIOD') return period.id;
           return 'T';
        });
        const key = keyParts.join(':');
        const val = originalData.dataset[key];
        if (val) row['Всего'] = parseFloat(val);
      }
      return row;
    });
  }, [dataset]);

  const lines = chartData.length > 0 ? Object.keys(chartData[0]).filter(k => k !== 'year') : [];
  const colors = ['#2563eb', '#db2777', '#16a34a', '#d97706', '#9333ea'];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-xl font-semibold mb-2">{dataset.title}</h3>
        <p className="text-gray-500 mb-6 text-sm">
          Данные из категории: <span className="font-medium text-gray-700">{dataset.category}</span>
        </p>
        
        {chartData.length > 0 ? (
          <div className="h-96 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="year" tick={{fill: '#6b7280', fontSize: 12}} tickLine={false} axisLine={{stroke: '#e5e7eb'}} />
                <YAxis tick={{fill: '#6b7280', fontSize: 12}} tickLine={false} axisLine={false} width={80} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                {lines.map((key, i) => (
                  <Line 
                    key={key} 
                    type="monotone" 
                    dataKey={key} 
                    stroke={colors[i % colors.length]} 
                    strokeWidth={3}
                    dot={{r: 4, strokeWidth: 2}}
                    activeDot={{r: 6}}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400">
            Нет данных для отображения графика
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-700">Сырые данные (Таблица)</h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Год
                </th>
                {lines.map(line => (
                  <th key={line} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {line}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {chartData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {row.year}
                  </td>
                  {lines.map(line => (
                    <td key={line} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row[line] !== undefined ? row[line].toLocaleString('ru-RU') : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
