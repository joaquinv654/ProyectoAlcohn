import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import AddPedidoModal from '../components/Pedidos/AddPedidoModal';
import EstadoSelect from '../components/EstadoSelect';
import FilterPanel from '../components/FilterPanel';
import {
  Plus,
  Filter,
  Search,
  X,
  Package,
  Upload
} from 'lucide-react';

const ESTADOS_FABRICACION = [
  'Sin Hacer', 'Haciendo', 'Rehacer', 'Retocar', 'Prioridad', 'Verificar', 'Hecho'
];
const ESTADOS_VENTA = [
  'Foto', 'Transferido', 'Ninguno'
];
const ESTADOS_ENVIO = [
  'Sin enviar', 'Hacer Etiqueta', 'Etiqueta Lista', 'Despachado', 'Seguimiento Enviado'
];

const initialFiltersState = {
  fecha_compra_gte: null,
  fecha_compra_lte: null,
  estado_fabricacion: [],
  estado_venta: [],
  estado_envio: [],
};




const getInclusiveEndDateISOString = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-');
  const endOfDay = new Date(year, month - 1, day);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.toISOString();
};

const getSignedUrl = async (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http')) {
    const idx = filePath.indexOf('/archivos-ventas/');
    if (idx !== -1) {
      filePath = filePath.substring(idx + '/archivos-ventas/'.length);
    }
  }
  const { data, error } = await supabase.storage
    .from('archivos-ventas')
    .createSignedUrl(filePath, 60);
  if (error) {
    alert('No se pudo generar el enlace de acceso al archivo');
    return null;
  }
  return data.signedUrl;
};

function ProduccionPage() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder] = useState('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    estado_fabricacion: [],
  });
  const [filters, setFilters] = useState(initialFiltersState);
  const [debouncedFilters, setDebouncedFilters] = useState(initialFiltersState);
  // Estado local para el valor mockeado de programado
  const [programadoValues, setProgramadoValues] = useState({});
  const opcionesProgramado = ['No Programado', 'Programado', 'En Proceso'];

  useEffect(() => {
    const fetchFilterOptions = async () => {
      const { data } = await supabase.from('pedidos').select('estado_fabricacion');
      if (data) {
        setFilterOptions({
          estado_fabricacion: [...new Set(data.map(item => item.estado_fabricacion).filter(Boolean))],
        });
      }
    };
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    const timerId = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  useEffect(() => {
    const timerId = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timerId);
  }, [filters]);

  const onClearFilters = () => {
    setFilters(initialFiltersState);
  };

  useEffect(() => {
    const getPedidos = async () => {
      try {
        setLoading(true);
        setError(null);
        let query = supabase.from('pedidos').select('*');
        // Filtros de búsqueda
        if (debouncedSearchTerm) {
          query = query.ilike('disenio', `%${debouncedSearchTerm}%`);
        }
        if (debouncedFilters.fecha_compra_gte) {
          query = query.gte('fecha_compra', debouncedFilters.fecha_compra_gte);
        }
        if (debouncedFilters.fecha_compra_lte) {
          const isoEndOfDay = getInclusiveEndDateISOString(debouncedFilters.fecha_compra_lte);
          query = query.lte('fecha_compra', isoEndOfDay);
        }
        if (debouncedFilters.estado_fabricacion.length > 0) {
          query = query.in('estado_fabricacion', debouncedFilters.estado_fabricacion);
        }
        query = query.order('fecha_compra', { ascending: sortOrder === 'asc' });
        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        setPedidos(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    getPedidos();
  }, [sortOrder, debouncedSearchTerm, debouncedFilters]);

  const handlePedidoAdded = () => {
    setIsModalOpen(false);
    // Refrescar pedidos
    setLoading(true);
    supabase.from('pedidos').select('*').then(({ data }) => {
      setPedidos(data || []);
      setLoading(false);
    });
  };

  const handleEstadoChange = async (pedido, campo, valor) => {
    try {
      const pedidoFields = {
        p_id: pedido.id_pedido,
        p_estado_fabricacion: campo === 'estado_fabricacion' ? valor : pedido.estado_fabricacion,
        p_estado_venta: campo === 'estado_venta' ? valor : pedido.estado_venta,
        p_estado_envio: campo === 'estado_envio' ? valor : pedido.estado_envio,
      };
      await supabase.rpc('editar_pedido', pedidoFields);
      // Refrescar pedidos
      const { data } = await supabase.from('pedidos').select('*');
      setPedidos(data || []);
    } catch {
      alert('Error al actualizar el estado');
    }
  };

  // const handleMaquinaChange = async (pedido, nuevaMaquina) => {
  //   try {
  //     await supabase.rpc('editar_pedido', {
  //       p_id: pedido.id_pedido,
  //       p_tipo_maquina: nuevaMaquina
  //     });
  //     // Refrescar pedidos
  //     const { data } = await supabase.from('pedidos').select('*');
  //     setPedidos(data || []);
  //   } catch {
  //     alert('Error al actualizar la máquina');
  //   }
  // };

  const handleVectorizacionChange = async (pedido, nuevaVectorizacion) => {
    try {
      await supabase.rpc('editar_pedido', {
        p_id: pedido.id_pedido,
        p_vectorizacion: nuevaVectorizacion
      });
      // Refrescar pedidos
      const { data } = await supabase.from('pedidos').select('*');
      setPedidos(data || []);
    } catch {
      alert('Error al actualizar la vectorización');
    }
  };

  const hayFiltrosActivos = Object.values(filters).some((filtro) => filtro !== "" && filtro !== null && (!Array.isArray(filtro) || filtro.length > 0));

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: 'white' }}>
      <div style={{ borderBottom: '1px solid rgba(39, 39, 42, 0.5)', background: 'rgba(9, 9, 11, 0.8)', position: 'sticky', top: 0, zIndex: 10, padding: '24px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package style={{ width: '20px', height: '20px', color: 'black' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '32px', fontWeight: '300', letterSpacing: '-0.025em', margin: 0 }}>
                  Producción
                </h1>
                <p style={{ fontSize: '12px', color: '#71717a', margin: '2px 0 0 0' }}>
                  {pedidos.length} activos
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: '#71717a'
              }} />
              <input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '320px',
                  background: 'rgba(39, 39, 42, 0.5)',
                  border: '1px solid rgba(63, 63, 70, 0.5)',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '8px 16px 8px 44px',
                  outline: 'none',
                  fontSize: '14px',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(96, 165, 250, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(63, 63, 70, 0.5)'}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                style={{
                  color: hayFiltrosActivos ? 'white' : '#a1a1aa',
                  background: hayFiltrosActivos ? 'rgba(39, 39, 42, 0.5)' : 'transparent',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = 'white';
                  e.target.style.background = 'rgba(39, 39, 42, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = hayFiltrosActivos ? 'white' : '#a1a1aa';
                  e.target.style.background = hayFiltrosActivos ? 'rgba(39, 39, 42, 0.5)' : 'transparent';
                }}
              >
                <Filter style={{ width: '16px', height: '16px' }} />
              </button>
              {showFilterPanel && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '48px',
                  width: '384px',
                  background: 'rgba(9, 9, 11, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(39, 39, 42, 0.5)',
                  borderRadius: '8px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  zIndex: 50,
                  padding: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '4px',
                        height: '24px',
                        background: 'linear-gradient(to bottom, #3b82f6, #8b5cf6)',
                        borderRadius: '9999px'
                      }}></div>
                      <h3 style={{ fontSize: '18px', fontWeight: '500', color: 'white', margin: 0 }}>Filtros</h3>
                    </div>
                    {hayFiltrosActivos && (
                      <button
                        onClick={onClearFilters}
                        style={{
                          color: '#a1a1aa',
                          background: 'transparent',
                          border: 'none',
                          fontSize: '12px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = 'white';
                          e.target.style.background = 'rgba(39, 39, 42, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#a1a1aa';
                          e.target.style.background = 'transparent';
                        }}
                      >
                        <X style={{ width: '12px', height: '12px' }} />
                        Limpiar
                      </button>
                    )}
                  </div>
                  <FilterPanel
                    filterOptions={filterOptions}
                    filters={filters}
                    setFilters={setFilters}
                    onClear={onClearFilters}
                    isExpanded={showFilterPanel}
                    onToggle={() => setShowFilterPanel(!showFilterPanel)}
                    showHeader={false}
                    visibleFilters={['fecha', 'estado_fabricacion']}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AddPedidoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onPedidoAdded={handlePedidoAdded} />
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: '32px' }}>
        <div className="table-container" style={{ background: 'rgba(9, 9, 11, 0.5)', border: '1px solid rgba(39, 39, 42, 0.5)', borderRadius: '8px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(39, 39, 42, 0.5)' }}>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '16px 12px', verticalAlign: 'middle' }}>Fecha</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '16px 12px', verticalAlign: 'middle' }}>Diseño</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '16px 12px', verticalAlign: 'middle' }}>Medida</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '16px 12px', verticalAlign: 'middle' }}>Notas</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '16px 12px', verticalAlign: 'middle' }}>Estado</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '16px 12px', verticalAlign: 'middle', minWidth: '140px' }}>Vectorización</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '16px 12px', verticalAlign: 'middle', minWidth: '140px' }}>Programado</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', padding: '16px 12px', verticalAlign: 'middle', minWidth: '220px' }}>Base</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', padding: '16px 12px', verticalAlign: 'middle' }}>Vector</th>
                  <th style={{ color: '#a1a1aa', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', padding: '16px 12px', verticalAlign: 'middle' }}>F Sello</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#71717a', padding: '32px' }}>Cargando...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#ef4444', padding: '32px' }}>Error: {error}</td>
                  </tr>
                ) : pedidos.length > 0 ? (
                  pedidos.map((pedido) => (
                    <tr key={pedido.id_pedido} style={{ borderBottom: '1px solid rgba(39, 39, 42, 0.3)', cursor: 'pointer', transition: 'background 0.3s ease' }}>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ color: '#a1a1aa', fontSize: '13px' }}>{pedido.fecha_compra ? new Date(pedido.fecha_compra).toLocaleDateString() : '-'}</span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div>
                          <span style={{ color: 'white', fontWeight: 500, fontSize: '15px', margin: 0, display: 'block' }}>{pedido.disenio || "Sin especificar"}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div>
                          <span style={{ color: 'white', fontWeight: 500, fontSize: '15px', margin: 0, display: 'block' }}>{pedido.medida_pedida || "Sin medida"}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div>
                          <span style={{ color: 'white', fontWeight: 500, fontSize: '15px', margin: 0, display: 'block' }}>{pedido.notas || "Sin notas"}</span>
                        </div>
                      </td>
                      <td style={{ minWidth: '220px', padding: '16px 12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <EstadoSelect
                            value={pedido.estado_fabricacion}
                            onChange={val => handleEstadoChange(pedido, 'estado_fabricacion', val)}
                            options={ESTADOS_FABRICACION}
                            type="fabricacion"
                            isDisabled={false}
                            size="small"
                            style={{ width: '75%' }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'left', verticalAlign: 'middle' }}>
                        <EstadoSelect
                          value={pedido.vectorizacion || 'Para Vectorizar'}
                          onChange={val => handleVectorizacionChange(pedido, val)}
                          options={['Para Vectorizar', 'Vectorizado']}
                          type="vectorizacion"
                          isDisabled={false}
                          size="small"
                          style={{ width: '60%' }}
                        />
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'left', verticalAlign: 'middle' }}>
                        <EstadoSelect
                          value={programadoValues[pedido.id_pedido] || 'No Programado'}
                          onChange={val => setProgramadoValues(prev => ({ ...prev, [pedido.id_pedido]: val }))}
                          options={opcionesProgramado}
                          type="programado"
                          isDisabled={false}
                          size="small"
                          style={{ width: '60%' }}
                        />
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <ArchivoCell
                          filePath={pedido.archivo_base}
                          nombre="Archivo Base"
                          pedidoId={pedido.id_pedido}
                          field="archivo_base"
                        />
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <ArchivoCell
                          filePath={pedido.archivo_vector}
                          nombre="Archivo Vector"
                          pedidoId={pedido.id_pedido}
                          field="archivo_vector"
                        />
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <ArchivoCell
                          filePath={pedido.foto_sello}
                          nombre="Foto Sello"
                          pedidoId={pedido.id_pedido}
                          field="foto_sello"
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#71717a', padding: '32px' }}>No se encontraron pedidos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para gestión de archivos estilo estetica.txt
function ArchivoCell({ filePath, nombre, pedidoId, field, onUpload, onDelete, _editing }) {
  const [signedUrl, setSignedUrl] = React.useState(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    if (!filePath) return;
    let mounted = true;
    getSignedUrl(filePath).then(url => { if (mounted) setSignedUrl(url); });
    return () => { mounted = false; };
  }, [filePath]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${field}_${pedidoId}_${timestamp}.${fileExtension}`;
      const { error } = await supabase.storage
        .from('archivos-ventas')
        .upload(fileName, file);
      if (error) throw error;
      const { data: publicData } = supabase.storage
        .from('archivos-ventas')
        .getPublicUrl(fileName);
      const updateData = {};
      updateData[`p_${field}`] = publicData.publicUrl;
      await supabase.rpc('editar_pedido', {
        p_id: pedidoId,
        ...updateData
      });
      if (onUpload) onUpload();
    } catch (err) {
      alert('Error al subir el archivo: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!signedUrl) return;
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filePath.split('/').pop();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo descargar el archivo');
    }
  };

  const handleDelete = () => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar ${nombre}?`)) {
      onDelete && onDelete(signedUrl || filePath, field, pedidoId);
    }
  };

  if (!filePath) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <label style={{
          color: '#a1a1aa',
          background: 'transparent',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.3s ease'
        }}
          onMouseEnter={(e) => {
            e.target.style.color = 'white';
            e.target.style.background = 'rgba(39, 39, 42, 0.5)';
            e.target.style.borderColor = 'rgba(96, 165, 250, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.color = '#a1a1aa';
            e.target.style.background = 'transparent';
            e.target.style.borderColor = 'rgba(63, 63, 70, 0.5)';
          }}
        >
          <Upload style={{ width: '12px', height: '12px' }} />
          {field === 'foto_sello' ? 'Foto' : 'Subir'}
          <input
            type="file"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            disabled={isUploading}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
        </label>
      </div>
    );
  }

  if (!signedUrl) return <span style={{ color: '#71717a', fontSize: '12px' }}>Cargando...</span>;

  const isImage = filePath.match(/\.(jpg|jpeg|png|gif|svg)$/i);

  if (isImage) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '48px', width: '48px' }}>
        <div
          style={{
            position: 'relative',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <a href={signedUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={signedUrl}
              alt={nombre}
              style={{
                width: '48px',
                height: '48px',
                objectFit: 'cover',
                borderRadius: '6px',
                border: '1px solid rgba(63, 63, 70, 0.5)',
                transition: 'border-color 0.3s ease'
              }}
            />
          </a>
          {isHovered && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              <button
                onClick={handleDownload}
                style={{
                  color: 'white',
                  fontSize: '10px',
                  background: 'rgba(39, 39, 42, 0.8)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.3s ease'
                }}
              >
                Ver
              </button>
              <button
                onClick={handleDelete}
                style={{
                  color: '#ef4444',
                  fontSize: '10px',
                  background: 'rgba(39, 39, 42, 0.8)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.3s ease'
                }}
              >
                X
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => window.open(signedUrl, '_blank')}
        style={{
          color: '#a1a1aa',
          background: 'transparent',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.color = 'white';
          e.target.style.background = 'rgba(39, 39, 42, 0.5)';
          e.target.style.borderColor = 'rgba(96, 165, 250, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.target.style.color = '#a1a1aa';
          e.target.style.background = 'transparent';
          e.target.style.borderColor = 'rgba(63, 63, 70, 0.5)';
        }}
      >
        <Upload style={{ width: '12px', height: '12px' }} />
        {field === 'foto_sello' ? 'Foto' : 'Ver'}
      </button>
    </div>
  );
}

function MaquinaSelect({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {['G', 'C'].map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            background: value === opt ? '#3b82f6' : 'transparent',
            color: value === opt ? 'white' : '#a1a1aa',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            padding: '4px 12px',
            fontWeight: 600,
            fontSize: '15px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default ProduccionPage; 