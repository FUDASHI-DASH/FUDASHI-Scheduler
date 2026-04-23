import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Clock, Users, Settings, Download, Plus, Trash2, AlertCircle, Award, Check, Cpu } from 'lucide-react';

export default function ScheduleAutomation() {
  const [activeTab, setActiveTab] = useState('agents');
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');
  const [operatingHours, setOperatingHours] = useState({});
  const [agents, setAgents] = useState([]);
  const [newAgentName, setNewAgentName] = useState('');
  const [agentAvailability, setAgentAvailability] = useState({});
  const [generatedSchedule, setGeneratedSchedule] = useState(null);
  const [scheduleAlerts, setScheduleAlerts] = useState([]);
  const [historicalScores, setHistoricalScores] = useState({});
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [currentDay, setCurrentDay] = useState(null);
  const [collapsedAgents, setCollapsedAgents] = useState({});
  const [selectionMode, setSelectionMode] = useState(null);

  useEffect(() => {
    const metaRobots = document.createElement('meta');
    metaRobots.name = "robots";
    metaRobots.content = "noindex, nofollow";
    document.head.appendChild(metaRobots);

    const preventPullToRefresh = (e) => {
      if (isSelecting) e.preventDefault();
    };
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });

    return () => {
      try { document.head.removeChild(metaRobots); } catch (e) {}
      document.removeEventListener('touchmove', preventPullToRefresh);
    };
  }, [isSelecting]);

  useEffect(() => {
    const handleGlobalUp = () => {
      setIsSelecting(false);
      setSelectionStart(null);
      setCurrentAgent(null);
      setCurrentDay(null);
      setSelectionMode(null);
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, []);

  const projectDays = useMemo(() => {
    if (!projectStartDate || !projectEndDate) return 0;
    const start = new Date(projectStartDate + 'T00:00:00');
    const end = new Date(projectEndDate + 'T00:00:00');
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, Math.min(31, days));
  }, [projectStartDate, projectEndDate]);

  const agentFlexibility = useMemo(() => {
    const scores = {};
    const totalPossibleSlots = projectDays * 24;

    agents.forEach(agent => {
      let unavailableCount = 0;
      let availableCount = 0;

      for (let day = 0; day < projectDays; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const hourKey = `day${day}_hour${hour}`;
          const isAvailable = agentAvailability[agent.id]?.[hourKey] !== false;
          if (isAvailable) availableCount++;
          else unavailableCount++;
        }
      }

      scores[agent.id] = {
        unavailableHours: unavailableCount,
        availableHours: availableCount,
        flexibilityScore: totalPossibleSlots > 0 ? (availableCount / totalPossibleSlots) * 100 : 0,
        scheduledHours: 0
      };
    });

    const avgUnavailable = agents.length > 0 && totalPossibleSlots > 0
      ? Object.values(scores).reduce((sum, s) => sum + s.unavailableHours, 0) / agents.length : 0;

    Object.keys(scores).forEach(agentId => {
      scores[agentId].classification = scores[agentId].unavailableHours > avgUnavailable ? 'limited' : 'flexible';
    });

    return scores;
  }, [agents, agentAvailability, projectDays]);

  const addAgent = () => {
    if (newAgentName.trim()) {
      const agentId = `agent_${Date.now()}`;
      setAgents([...agents, { id: agentId, name: newAgentName.trim().toUpperCase(), target: 40, max: 40 }]);
      setNewAgentName('');
    }
  };

  const updateAgentParams = (agentId, field, value) => {
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, [field]: parseFloat(value) || 0 } : a));
  };

  const removeAgent = (agentId) => {
    setAgents(agents.filter(a => a.id !== agentId));
    const newAvail = { ...agentAvailability };
    delete newAvail[agentId];
    setAgentAvailability(newAvail);
  };

  const updateAvailability = (agentId, dayIndex, hour, available) => {
    const key = `day${dayIndex}_hour${hour}`;
    setAgentAvailability(prev => ({ ...prev, [agentId]: { ...prev[agentId], [key]: available } }));
  };

  const toggleAgentCollapse = (agentId) => setCollapsedAgents(prev => ({ ...prev, [agentId]: !prev[agentId] }));

  const getAgentAvailabilityPercentage = (agentId) => {
    const flex = agentFlexibility[agentId];
    return flex ? flex.flexibilityScore.toFixed(1) : '0.0';
  };

  const getAgentScheduledHours = (agentId) => {
    if (!generatedSchedule) return 0;
    let totalHours = 0;
    Object.values(generatedSchedule).forEach(dayData => {
      dayData.shifts.forEach(shift => {
        if (shift.assignedDetails) {
          shift.assignedDetails.forEach(detail => {
            const match = detail.match(/[⚠️⭐]\s+(.+?)\s+\((\d+\.?\d*)h\)/);
            if (match) {
              const agentName = match[1];
              const hours = parseFloat(match[2]);
              const agent = agents.find(a => a.name === agentName);
              if (agent && agent.id === agentId) totalHours += hours;
            }
          });
        }
      });
    });
    return totalHours;
  };

  const getAgentStats = (agentId) => {
    const flex = agentFlexibility[agentId];
    const scheduledHours = getAgentScheduledHours(agentId);
    const agentObj = agents.find(a => a.id === agentId) || { target: 40, max: 40 };
    return {
      availableHours: flex?.availableHours || 0,
      unavailableHours: flex?.unavailableHours || 0,
      scheduledHours,
      flexibilityScore: flex?.flexibilityScore || 0,
      classification: flex?.classification || 'unknown',
      target: agentObj.target,
      max: agentObj.max
    };
  };

  const setDayAvailability = (agentId, dayIndex, available) => {
    const updates = {};
    for (let hour = 0; hour < 24; hour++) updates[`day${dayIndex}_hour${hour}`] = available;
    setAgentAvailability(prev => ({ ...prev, [agentId]: { ...prev[agentId], ...updates } }));
  };

  const handlePointerDown = (agentId, dayIndex, hour, e) => {
    e.preventDefault();
    setIsSelecting(true);
    setSelectionStart(hour);
    setCurrentAgent(agentId);
    setCurrentDay(dayIndex);
    const key = `day${dayIndex}_hour${hour}`;
    const currentValue = agentAvailability[agentId]?.[key] !== false;
    const newValue = !currentValue;
    setSelectionMode(newValue ? 'available' : 'unavailable');
    updateAvailability(agentId, dayIndex, hour, newValue);
  };

  const handlePointerEnter = (agentId, dayIndex, hour) => {
    if (isSelecting && agentId === currentAgent && dayIndex === currentDay && selectionStart !== null) {
      const start = Math.min(selectionStart, hour);
      const end = Math.max(selectionStart, hour);
      const targetValue = selectionMode === 'available';
      for (let h = start; h <= end; h++) updateAvailability(agentId, dayIndex, h, targetValue);
    }
  };

  const handleTouchMove = useCallback((agentId, dayIndex, e) => {
    if (!isSelecting || agentId !== currentAgent || dayIndex !== currentDay) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element?.dataset.hour !== undefined) {
      const hour = parseInt(element.dataset.hour);
      handlePointerEnter(agentId, dayIndex, hour);
    }
  }, [isSelecting, currentAgent, currentDay, selectionStart, selectionMode]);

  const handleHOOPPointerDown = (dayIndex, hour, e) => {
    e.preventDefault();
    setIsSelecting(true);
    setSelectionStart(hour);
    setCurrentDay(dayIndex);
    const key = `day${dayIndex}_hour${hour}`;
    const newValue = !operatingHours[key];
    setSelectionMode(newValue ? 'available' : 'unavailable');
    setOperatingHours(prev => ({ ...prev, [key]: newValue }));
  };

  const handleHOOPPointerEnter = (dayIndex, hour) => {
    if (isSelecting && dayIndex === currentDay && selectionStart !== null) {
      const start = Math.min(selectionStart, hour);
      const end = Math.max(selectionStart, hour);
      const targetValue = selectionMode === 'available';
      for (let h = start; h <= end; h++) setOperatingHours(prev => ({ ...prev, [`day${dayIndex}_hour${h}`]: targetValue }));
    }
  };

  const handleHOOPTouchMove = useCallback((dayIndex, e) => {
    if (!isSelecting || dayIndex !== currentDay) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element?.dataset.hour !== undefined) {
      const hour = parseInt(element.dataset.hour);
      handleHOOPPointerEnter(dayIndex, hour);
    }
  }, [isSelecting, currentDay, selectionStart, selectionMode]);

  const getHourCategory = (hour) => {
    if (hour >= 18 || hour < 7) return 'hard';
    if (hour >= 9 && hour <= 16) return 'prime';
    return 'middle';
  };

  const getDateForDay = (dayIndex) => {
    if (!projectStartDate) return `DAY ${dayIndex + 1}`;
    const date = new Date(projectStartDate + 'T00:00:00');
    date.setDate(date.getDate() + dayIndex);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  };

  const formatTime = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${period}`;
  };

  const generateSchedule = () => {
    const schedule = {};
    const agentWeeklyHours = {};
    const agentTotalHours = {};
    const agentShiftTracking = {};
    const alerts = [];

    agents.forEach(agent => {
      agentWeeklyHours[agent.id] = {};
      agentTotalHours[agent.id] = 0;
      agentShiftTracking[agent.id] = { lastShiftEnd: null, dailyHours: {} };
    });

    const getWeekKey = (day) => `Week_${Math.floor(day / 7)}`;

    const globalShifts = [];
    let currentShift = null;
    for (let day = 0; day < projectDays; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `day${day}_hour${hour}`;
        if (operatingHours[key]) {
          if (!currentShift) currentShift = { startDay: day, startHour: hour, hours: [] };
          currentShift.hours.push({ day, hour });
        } else if (currentShift) {
          globalShifts.push(currentShift);
          currentShift = null;
        }
      }
    }
    if (currentShift) globalShifts.push(currentShift);

    for (let day = 0; day < projectDays; day++) schedule[day] = { shifts: [] };

    globalShifts.forEach(shift => {
      const shiftDuration = shift.hours.length;
      const lastSlot = shift.hours[shift.hours.length - 1];
      shift.endDay = lastSlot.day;
      shift.endHour = lastSlot.hour + 1;
      const weekKey = getWeekKey(shift.startDay);

      if (shiftDuration < 3.5) {
        alerts.push({ type: 'error', day: shift.startDay, message: `Shift ${shiftDuration}h < 3.5h minimum` });
        shift.assignedDetails = ["UNFILLABLE (< 3.5h)"];
        shift.filled = false;
        schedule[shift.startDay].shifts.push(shift);
        return;
      }

      const assignments = [];
      const coveredIndices = new Set();

      const limitedAgents = agents.filter(a => agentFlexibility[a.id].classification === 'limited');
      limitedAgents.sort((a, b) => {
        const gapA = a.target - agentTotalHours[a.id];
        const gapB = b.target - agentTotalHours[b.id];
        if (gapA !== gapB) return gapB - gapA;
        return agentFlexibility[a.id].availableHours - agentFlexibility[b.id].availableHours;
      });

      limitedAgents.forEach(agent => {
        const workedTotal = agentTotalHours[agent.id];
        if (workedTotal >= agent.max) return;

        let startIdx = -1, endIdx = -1;
        for (let i = 0; i < shiftDuration; i++) {
          const h = shift.hours[i];
          const isAvail = agentAvailability[agent.id]?.[`day${h.day}_hour${h.hour}`] !== false;
          if (isAvail && !coveredIndices.has(i)) {
            if (startIdx === -1) startIdx = i;
            endIdx = i;
          } else if (startIdx !== -1) break;
        }

        if (startIdx !== -1) {
          let validStart = startIdx, validEnd = endIdx + 1;
          let duration = validEnd - validStart;
          if (workedTotal + duration > agent.max) {
            duration = agent.max - workedTotal;
            validEnd = validStart + duration;
          }
          if (duration < 3.5) return;

          const preGapSize = validStart;
          if (preGapSize > 0 && preGapSize < 3.5) validStart += (3.5 - preGapSize);
          const postGapSize = shiftDuration - validEnd;
          if (postGapSize > 0 && postGapSize < 3.5) validEnd -= (3.5 - postGapSize);

          duration = validEnd - validStart;
          if (duration >= 3.5) {
            if (duration > 8) { validEnd = validStart + 8; duration = 8; }
            if (workedTotal + duration > agent.max) return;

            assignments.push({ agent, startIndex: validStart, length: duration, classification: 'limited' });
            for (let k = Math.ceil(validStart); k < Math.floor(validEnd); k++) coveredIndices.add(k);
            if (!agentWeeklyHours[agent.id][weekKey]) agentWeeklyHours[agent.id][weekKey] = 0;
            agentWeeklyHours[agent.id][weekKey] += duration;
            agentTotalHours[agent.id] += duration;
          }
        }
      });

      assignments.sort((a, b) => a.startIndex - b.startIndex);
      let currentTime = 0;
      const gaps = [];
      assignments.forEach(assign => {
        if (assign.startIndex > currentTime) gaps.push({ start: currentTime, end: assign.startIndex });
        currentTime = Math.max(currentTime, assign.startIndex + assign.length);
      });
      if (currentTime < shiftDuration) gaps.push({ start: currentTime, end: shiftDuration });

      gaps.forEach(gap => {
        let gapDuration = gap.end - gap.start;
        if (gapDuration < 0.1) return;

        const agentsNeeded = Math.ceil(gapDuration / 8);
        const hoursPerAgent = gapDuration / agentsNeeded;
        let chunkStart = gap.start;
        const flexibleAgents = agents.filter(a => agentFlexibility[a.id].classification !== 'limited');

        for (let i = 0; i < agentsNeeded; i++) {
          let chunkLen = Math.max(3.5, Math.min(8, hoursPerAgent));
          if (chunkStart + chunkLen > gap.end) chunkLen = gap.end - chunkStart;

          const midPoint = chunkStart + (chunkLen / 2);
          const midHour = shift.hours[Math.floor(midPoint)]?.hour || 12;
          const isPrime = getHourCategory(midHour) === 'prime';

          flexibleAgents.sort((a, b) => {
            const gapA = a.target - agentTotalHours[a.id];
            const gapB = b.target - agentTotalHours[b.id];
            if (gapA > 0 && gapB <= 0) return -1;
            if (gapA <= 0 && gapB > 0) return 1;
            if (gapA > 0 && gapB > 0 && Math.abs(gapA - gapB) > 2) return gapB - gapA;
            if (isPrime) return agentFlexibility[b.id].flexibilityScore - agentFlexibility[a.id].flexibilityScore;
            return agentTotalHours[a.id] - agentTotalHours[b.id];
          });

          const segmentHours = shift.hours.slice(Math.floor(chunkStart), Math.ceil(chunkStart + chunkLen));
          const winner = flexibleAgents.find(agent => {
            const workedTotal = agentTotalHours[agent.id];
            if (workedTotal + chunkLen > agent.max) return false;
            const isAvail = segmentHours.every(h => agentAvailability[agent.id]?.[`day${h.day}_hour${h.hour}`] !== false);
            if (!isAvail) return false;
            if ((agentWeeklyHours[agent.id][weekKey] || 0) + chunkLen > 40) return false;
            const sliceStartDay = segmentHours[0]?.day;
            if ((agentShiftTracking[agent.id].dailyHours[sliceStartDay] || 0) >= 8) return false;
            const lastEnd = agentShiftTracking[agent.id].lastShiftEnd;
            if (lastEnd) {
              const startAbs = shift.hours[0].day * 24 + shift.hours[0].hour + chunkStart;
              if (startAbs - lastEnd < 11) return false;
            }
            return true;
          });

          if (winner) {
            assignments.push({ agent: winner, startIndex: chunkStart, length: chunkLen, classification: 'flexible' });
            if (!agentWeeklyHours[winner.id][weekKey]) agentWeeklyHours[winner.id][weekKey] = 0;
            agentWeeklyHours[winner.id][weekKey] += chunkLen;
            agentTotalHours[winner.id] += chunkLen;
            segmentHours.forEach(h => {
              if (!agentShiftTracking[winner.id].dailyHours[h.day]) agentShiftTracking[winner.id].dailyHours[h.day] = 0;
              agentShiftTracking[winner.id].dailyHours[h.day] += (chunkLen / segmentHours.length);
            });
            agentShiftTracking[winner.id].lastShiftEnd = shift.hours[0].day * 24 + shift.hours[0].hour + chunkStart + chunkLen;
          } else {
            assignments.push({ agent: { name: "UNFILLED" }, startIndex: chunkStart, length: chunkLen, classification: 'unknown' });
          }
          chunkStart += chunkLen;
        }
      });

      assignments.sort((a, b) => a.startIndex - b.startIndex);
      const totalCovered = assignments.filter(a => a.agent.name !== "UNFILLED").reduce((sum, a) => sum + a.length, 0);
      const isCovered = Math.abs(totalCovered - shiftDuration) < 0.1;

      if (!isCovered) {
        alerts.push({ type: 'warning', day: shift.startDay, message: `Covered ${totalCovered.toFixed(1)}/${shiftDuration}h` });
      }

      shift.assignedDetails = assignments.map(a => {
        if (a.agent.name === "UNFILLED") return `❌ UNFILLED`;
        const badge = a.classification === 'limited' ? '⚠️' : '⭐';
        return `${badge} ${a.agent.name} (${a.length.toFixed(1)}h)`;
      });
      shift.filled = isCovered;
      schedule[shift.startDay].shifts.push(shift);
    });

    setGeneratedSchedule(schedule);
    setScheduleAlerts(alerts);
    setActiveTab('schedule');
    setHistoricalScores({ [new Date().toISOString()]: { ...agentFlexibility } });
  };

  const tabs = [
    { id: 'agents',      label: 'AGENTS',   icon: Users },
    { id: 'flexibility', label: 'FLEX',     icon: Award },
    { id: 'project',     label: 'HOOP',     icon: Clock },
    { id: 'rules',       label: 'GENERATE', icon: Settings },
    { id: 'schedule',    label: 'SCHEDULE', icon: Download },
  ];

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-mark">
            <div className="lbar lbar1" />
            <div className="lbar lbar2" />
            <div className="lbar lbar3" />
          </div>
          <div className="logo-text">FUDASHI</div>
          <div className="logo-sub">PHUTURE</div>
        </div>

        <nav className="nav-section">
          <div className="nav-label">Navigation</div>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="avatar">F</div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700 }}>FUDASHI</div>
              <div style={{ fontSize: '10px', color: 'var(--g400)' }}>SCHEDULER v2</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{tabs.find(t => t.id === activeTab)?.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="status-dot" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--g300)' }}>ONLINE</span>
          </div>
        </div>

        <div className="content">

          {/* ── AGENTS TAB ── */}
          {activeTab === 'agents' && (
            <div>
              <div className="section">
                <div className="section-head">
                  <div className="section-title">Project Dates</div>
                </div>
                <div className="section-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label>Project Start</label>
                      <input type="date" value={projectStartDate} onChange={e => setProjectStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label>Project End</label>
                      <input type="date" value={projectEndDate} onChange={e => setProjectEndDate(e.target.value)} />
                    </div>
                  </div>
                  {projectDays > 0 && (
                    <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--lime-dim)', border: '1px solid var(--lime-b)', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--lime)' }}>
                      📅 {projectDays} DAYS CONFIGURED
                    </div>
                  )}
                </div>
              </div>

              <div className="section">
                <div className="section-head">
                  <div className="section-title">Add Agent</div>
                </div>
                <div className="section-body">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newAgentName}
                      onChange={e => setNewAgentName(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addAgent()}
                      placeholder="Enter agent name..."
                    />
                    <button onClick={addAgent} className="btn btn-lime" style={{ whiteSpace: 'nowrap' }}>
                      <Plus size={12} /> ADD
                    </button>
                  </div>
                </div>
              </div>

              {agents.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--g500)' }}>
                  <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '12px' }}>No agents added yet</p>
                </div>
              )}

              {agents.map(agent => {
                const isCollapsed = collapsedAgents[agent.id];
                return (
                  <div key={agent.id} className="agent-card">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--lime)', flexShrink: 0 }} />
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{agent.name}</div>
                          {isCollapsed && (
                            <span className="pill pill-lime">
                              <Check size={8} style={{ marginRight: '3px' }} />
                              {getAgentAvailabilityPercentage(agent.id)}%
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeAgent(agent.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--g400)', padding: '4px', lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--g400)'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <label style={{ marginBottom: 0 }}>Target</label>
                          <input
                            type="number"
                            value={agent.target || 40}
                            onChange={e => updateAgentParams(agent.id, 'target', e.target.value)}
                            style={{ width: '56px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <label style={{ marginBottom: 0 }}>Max</label>
                          <input
                            type="number"
                            value={agent.max || 40}
                            onChange={e => updateAgentParams(agent.id, 'max', e.target.value)}
                            style={{ width: '56px' }}
                          />
                        </div>
                        <button
                          onClick={() => toggleAgentCollapse(agent.id)}
                          className={`btn btn-sm ${isCollapsed ? 'btn-ghost' : 'btn-lime'}`}
                          style={{ marginLeft: 'auto' }}
                        >
                          {isCollapsed ? 'EDIT' : 'CONFIRM'}
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && projectDays > 0 && (
                      <div>
                        <p style={{ fontSize: '10px', color: 'var(--g400)', marginBottom: '8px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--lime)' }}>■ AVAIL</span>
                          {' / '}
                          <span style={{ color: 'var(--red)' }}>■ BLOCKED</span>
                          {' — TAP OR DRAG'}
                        </p>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {Array.from({ length: projectDays }).map((_, dayIndex) => (
                            <div key={dayIndex} style={{ background: 'var(--g900)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--g300)' }}>{getDateForDay(dayIndex)}</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => setDayAvailability(agent.id, dayIndex, true)}
                                    style={{ fontSize: '10px', color: 'var(--lime)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>ALL</button>
                                  <button onClick={() => setDayAvailability(agent.id, dayIndex, false)}
                                    style={{ fontSize: '10px', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>NONE</button>
                                </div>
                              </div>
                              <div style={{ overflowX: 'auto' }} onTouchMove={e => handleTouchMove(agent.id, dayIndex, e)}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(28px, 1fr))', gap: '1px', minWidth: '672px' }}>
                                  {Array.from({ length: 24 }).map((_, hour) => {
                                    const isAvailable = agentAvailability[agent.id]?.[`day${dayIndex}_hour${hour}`] !== false;
                                    return (
                                      <div
                                        key={hour}
                                        data-hour={hour}
                                        onMouseDown={e => handlePointerDown(agent.id, dayIndex, hour, e)}
                                        onMouseEnter={() => handlePointerEnter(agent.id, dayIndex, hour)}
                                        onTouchStart={e => handlePointerDown(agent.id, dayIndex, hour, e)}
                                        style={{
                                          height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                          justifyContent: 'center', fontSize: '9px', fontWeight: 700,
                                          userSelect: 'none', touchAction: 'none', borderRadius: '2px',
                                          background: isAvailable ? 'var(--lime-dim)' : 'rgba(255,32,64,0.25)',
                                          color: isAvailable ? 'var(--lime)' : 'var(--red)',
                                          borderRight: `1px solid ${isAvailable ? 'var(--lime-b)' : 'var(--red-b)'}`,
                                        }}
                                      >
                                        {hour}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── FLEXIBILITY TAB ── */}
          {activeTab === 'flexibility' && (
            <div>
              <div className="section">
                <div className="section-head">
                  <div className="section-title">Algorithm v2.0</div>
                </div>
                <div className="section-body">
                  <p style={{ fontSize: '12px', color: 'var(--g300)', lineHeight: 1.7 }}>
                    1. <span style={{ color: 'var(--orange)', fontWeight: 700 }}>LIMITED</span> agents get extreme hours first.<br />
                    2. <span style={{ color: 'var(--lime)', fontWeight: 700 }}>FLEXIBLE</span> agents fill gaps.<br />
                    3. <span style={{ fontWeight: 700 }}>MAX CAP</span> is strictly enforced.
                  </p>
                </div>
              </div>

              {agents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--g500)' }}>
                  <Award size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '12px' }}>No agents to analyze</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {agents.map(agent => {
                    const stats = getAgentStats(agent.id);
                    const isLimited = stats.classification === 'limited';
                    return (
                      <div key={agent.id} className={`stat-card ${isLimited ? 'accent-orange' : 'accent-lime'}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div style={{ fontWeight: 800, fontSize: '14px' }}>{agent.name}</div>
                          <span className={`pill ${isLimited ? 'pill-orange' : 'pill-lime'}`}>
                            {isLimited ? '⚠️ LTD' : '⭐ FLX'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--g300)' }}>
                            <span>AVAIL</span><span style={{ color: '#fff', fontWeight: 700 }}>{stats.availableHours}H</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--g300)' }}>
                            <span>BLOCKED</span><span style={{ color: '#fff', fontWeight: 700 }}>{stats.unavailableHours}H</span>
                          </div>
                          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--g300)' }}>
                            <span>TARGET</span><span style={{ color: 'var(--lime)', fontWeight: 700 }}>{stats.target}H</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--g300)' }}>
                            <span>MAX</span><span style={{ color: 'var(--orange)', fontWeight: 700 }}>{stats.max}H</span>
                          </div>
                          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--g300)' }}>SCHEDULED</span>
                            <span style={{ fontWeight: 800, fontSize: '16px', color: stats.scheduledHours > stats.max ? 'var(--red)' : 'var(--lime)' }}>
                              {stats.scheduledHours.toFixed(1)}H
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── HOOP TAB ── */}
          {activeTab === 'project' && (
            <div>
              <div className="section">
                <div className="section-head">
                  <div className="section-title">Hour Legend</div>
                </div>
                <div className="section-body">
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', background: 'var(--lime-dim)', border: '1px solid var(--lime-b)', borderRadius: '2px', display: 'inline-block' }} />
                      PRIME
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', background: 'var(--red-dim)', border: '1px solid var(--red-b)', borderRadius: '2px', display: 'inline-block' }} />
                      EXTREME
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', background: 'var(--orange-dim)', border: '1px solid var(--orange-b)', borderRadius: '2px', display: 'inline-block' }} />
                      STANDARD
                    </div>
                  </div>
                </div>
              </div>

              {projectDays === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--g500)' }}>
                  <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '12px' }}>Set project dates first</p>
                </div>
              ) : (
                <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Array.from({ length: projectDays }).map((_, dayIndex) => (
                    <div key={dayIndex} style={{ background: 'var(--g800)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--g300)', marginBottom: '8px', fontSize: '10px' }}>{getDateForDay(dayIndex)}</div>
                      <div style={{ overflowX: 'auto' }} onTouchMove={e => handleHOOPTouchMove(dayIndex, e)}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(28px, 1fr))', gap: '2px', minWidth: '672px' }}>
                          {Array.from({ length: 24 }).map((_, h) => {
                            const isOn = operatingHours[`day${dayIndex}_hour${h}`];
                            const cat = getHourCategory(h);
                            let bg = 'var(--g900)', color = 'var(--g600)', borderColor = 'var(--border)';
                            if (isOn) {
                              if (cat === 'prime')  { bg = 'var(--lime-dim)';   color = 'var(--lime)';   borderColor = 'var(--lime-b)'; }
                              else if (cat === 'hard') { bg = 'var(--red-dim)'; color = 'var(--red)';    borderColor = 'var(--red-b)'; }
                              else                  { bg = 'var(--orange-dim)'; color = 'var(--orange)'; borderColor = 'var(--orange-b)'; }
                            }
                            return (
                              <button
                                key={h}
                                data-hour={h}
                                onMouseDown={e => handleHOOPPointerDown(dayIndex, h, e)}
                                onMouseEnter={() => handleHOOPPointerEnter(dayIndex, h)}
                                onTouchStart={e => handleHOOPPointerDown(dayIndex, h, e)}
                                style={{
                                  height: '36px', fontSize: '9px', fontWeight: 700,
                                  border: `1px solid ${borderColor}`, borderRadius: '4px',
                                  background: bg, color, cursor: 'pointer', touchAction: 'none',
                                }}
                              >
                                {h}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── GENERATE TAB ── */}
          {activeTab === 'rules' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', textAlign: 'center', padding: '20px' }}>
              <Cpu size={64} style={{ color: 'var(--orange)', marginBottom: '20px' }} />
              <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '10px', letterSpacing: '0.05em' }}>Ready to Compile</h3>
              <p style={{ maxWidth: '400px', color: 'var(--g300)', marginBottom: '24px', fontSize: '12px', lineHeight: 1.7 }}>
                INITIATING SCHEDULING ALGORITHM...<br />
                OPTIMIZING FOR TARGET HOURS...<br />
                ENFORCING MAX CAPS...
              </p>
              <button
                onClick={generateSchedule}
                disabled={agents.length === 0 || projectDays === 0}
                className="btn btn-lime"
                style={{ fontSize: '14px', padding: '12px 32px' }}
              >
                GENERATE
              </button>
              {(agents.length === 0 || projectDays === 0) && (
                <p style={{ marginTop: '16px', fontSize: '11px', color: 'var(--g500)', textTransform: 'uppercase' }}>
                  {agents.length === 0 ? 'Add agents first' : 'Set project dates first'}
                </p>
              )}
            </div>
          )}

          {/* ── SCHEDULE TAB ── */}
          {activeTab === 'schedule' && (
            <div>
              {!generatedSchedule ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--g500)' }}>
                  <Download size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '12px' }}>No schedule generated</p>
                </div>
              ) : (
                <>
                  {scheduleAlerts.length > 0 && (
                    <div style={{
                      padding: '12px 16px', background: 'var(--red-dim)', border: '1px solid var(--red-b)',
                      borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px'
                    }}>
                      {scheduleAlerts.map((alert, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--red)', fontSize: '11px', fontWeight: 700 }}>
                          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span>{alert.message} ({getDateForDay(alert.day)})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(generatedSchedule).map(([day, data]) => (
                      <div key={day} className="section" style={{ borderLeft: '3px solid var(--lime)' }}>
                        <div className="section-head">
                          <div className="section-title">{getDateForDay(parseInt(day))}</div>
                          <div className="brand-bar">
                            <div className="bb1" /><div className="bb2" /><div className="bb3" />
                          </div>
                        </div>
                        <div className="section-body">
                          {data.shifts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--g500)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', border: '1px dashed var(--border)', borderRadius: '6px' }}>
                              NO OPS
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {data.shifts.map((shift, i) => (
                                <div key={i} style={{ background: 'var(--g700)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <Clock size={14} style={{ color: 'var(--lime)', flexShrink: 0 }} />
                                      <div>
                                        <div style={{ fontWeight: 800, fontSize: '14px' }}>
                                          {formatTime(shift.startHour)} – {formatTime(shift.endHour % 24)}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--g400)', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>
                                          {shift.hours.length}H
                                          {shift.endDay > shift.startDay && (
                                            <span style={{ color: 'var(--orange)', marginLeft: '6px' }}>OVERNIGHT</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      {shift.hours.some(h => getHourCategory(h.hour) === 'hard') && (
                                        <span className="pill pill-red">Extreme</span>
                                      )}
                                      {shift.hours.some(h => getHourCategory(h.hour) === 'prime') && (
                                        <span className="pill pill-lime">Prime</span>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {shift.assignedDetails.map((d, idx) => (
                                      <span
                                        key={idx}
                                        className={`pill ${
                                          d.startsWith('⭐') ? 'pill-lime'
                                          : d.startsWith('⚠️') ? 'pill-orange'
                                          : 'pill-gray'
                                        }`}
                                      >
                                        {d}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
