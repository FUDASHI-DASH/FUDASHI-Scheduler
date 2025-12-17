import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Clock, Users, Settings, Download, Plus, Trash2, AlertCircle, Award, Check, Cpu, Globe } from 'lucide-react';

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

  // --- NO INDEX & SETUP ---
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

  const getHourCategoryColor = (hour) => {
    const category = getHourCategory(hour);
    if (category === 'hard') return 'bg-pink-900/60 border-pink-500 text-pink-200';
    if (category === 'prime') return 'bg-cyan-900/60 border-cyan-500 text-cyan-200';
    return 'bg-blue-900/60 border-blue-500 text-blue-200';
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
    { id: 'agents', label: 'AGENTS', icon: Users },
    { id: 'flexibility', label: 'FLEX', icon: Award },
    { id: 'project', label: 'HOOP', icon: Clock },
    { id: 'rules', label: 'GENERATE', icon: Settings },
    { id: 'schedule', label: 'SCHEDULE', icon: Download },
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-mono text-cyan-400 p-3 sm:p-6 selection:bg-pink-500 selection:text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-900 border-2 border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.3)] p-4 sm:p-8 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"4\" height=\"4\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Crect width=\"1\" height=\"1\" fill=\"%23000\"%3E%3C/rect%3E%3C/svg%3E')"}}></div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-4xl sm:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-cyan-500 to-blue-600 transform -skew-x-12">FUDASHI</div>
              <div className="h-12 sm:h-16 w-1 bg-gradient-to-b from-pink-500 to-cyan-500 hidden sm:block"></div>
              <div className="hidden sm:block">
                <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-[0.2em]">PHUTURE</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Globe className="w-4 h-4 text-pink-500 animate-spin" style={{animationDuration: '8s'}} />
                  <p className="text-pink-500 font-bold tracking-wider text-xs sm:text-sm uppercase">EARTH IS STILL SPINNING</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 border border-cyan-500/30 p-2 bg-slate-950/50">
              <div className="text-right">
                <div className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest">Status</div>
                <div className="text-xs text-cyan-400 font-bold tracking-wider animate-pulse">ONLINE</div>
              </div>
              <div className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]"></div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-slate-900/80 border-b border-pink-500/30 mb-6 overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-6 py-3 font-bold text-xs sm:text-sm tracking-wider transition-all border-b-4 ${
                    activeTab === tab.id ? 'text-white border-pink-500 bg-gradient-to-t from-pink-900/20 to-transparent' : 'text-slate-500 border-transparent hover:text-cyan-400'
                  }`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900 border border-cyan-500/20 p-4 sm:p-8 min-h-[500px]">
          
          {/* AGENTS TAB */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-pink-500 mb-2 uppercase tracking-widest">Project Start</label>
                  <input type="date" value={projectStartDate} onChange={(e) => setProjectStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-cyan-500/30 text-cyan-400 focus:border-pink-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-pink-500 mb-2 uppercase tracking-widest">Project End</label>
                  <input type="date" value={projectEndDate} onChange={(e) => setProjectEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-cyan-500/30 text-cyan-400 focus:border-pink-500 focus:outline-none" />
                </div>
              </div>

              {projectDays > 0 && (
                <div className="text-xs text-cyan-500 font-bold uppercase p-2 bg-cyan-500/10 border border-cyan-500/30">
                  📅 {projectDays} DAYS CONFIGURED
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 p-3 bg-slate-950/50 border border-dashed border-slate-700">
                <input type="text" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addAgent()} placeholder="ENTER AGENT ID..."
                  className="flex-1 px-3 py-2.5 bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none uppercase text-sm" />
                <button onClick={addAgent}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-black font-black uppercase tracking-widest text-sm">
                  <Plus className="w-4 h-4" /> ADD
                </button>
              </div>

              {agents.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-bold uppercase tracking-wider">No agents added yet</p>
                </div>
              )}

              {agents.map(agent => {
                const isCollapsed = collapsedAgents[agent.id];
                return (
                  <div key={agent.id} className="border border-slate-700 bg-slate-800/50 p-3 sm:p-4">
                    <div className="flex flex-col gap-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
                          <div className="font-bold text-lg text-white">{agent.name}</div>
                          {isCollapsed && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 text-[10px] font-bold">
                              <Check className="w-3 h-3" />{getAgentAvailabilityPercentage(agent.id)}%
                            </span>
                          )}
                        </div>
                        <button onClick={() => removeAgent(agent.id)} className="text-slate-600 hover:text-pink-500 p-1.5">
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-cyan-500 uppercase">Target</label>
                          <input type="number" value={agent.target || 40} onChange={(e) => updateAgentParams(agent.id, 'target', e.target.value)}
                            className="w-14 px-2 py-1 bg-slate-900 border border-cyan-500/50 text-cyan-400 text-xs font-bold focus:outline-none" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-pink-500 uppercase">Max</label>
                          <input type="number" value={agent.max || 40} onChange={(e) => updateAgentParams(agent.id, 'max', e.target.value)}
                            className="w-14 px-2 py-1 bg-slate-900 border border-pink-500/50 text-pink-400 text-xs font-bold focus:outline-none" />
                        </div>
                        <button onClick={() => toggleAgentCollapse(agent.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase border ml-auto ${
                            isCollapsed ? 'border-pink-500 text-pink-500' : 'bg-cyan-600 text-black border-cyan-600'
                          }`}>
                          {isCollapsed ? 'EDIT' : 'CONFIRM'}
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && projectDays > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-400 mb-3 font-bold uppercase">
                          <span className="text-cyan-400">■ AVAIL</span> / <span className="text-pink-500">■ BLOCKED</span> - TAP OR DRAG
                        </p>
                        <div className="space-y-1 max-h-[400px] overflow-y-auto">
                          {Array.from({ length: projectDays }).map((_, dayIndex) => (
                            <div key={dayIndex} className="bg-slate-950 p-2 border border-slate-800">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[10px] font-bold text-slate-400">{getDateForDay(dayIndex)}</div>
                                <div className="flex gap-2">
                                  <button onClick={() => setDayAvailability(agent.id, dayIndex, true)} className="text-[10px] text-cyan-500 hover:underline">ALL</button>
                                  <button onClick={() => setDayAvailability(agent.id, dayIndex, false)} className="text-[10px] text-pink-500 hover:underline">NONE</button>
                                </div>
                              </div>
                              <div className="overflow-x-auto touch-pan-x" onTouchMove={(e) => handleTouchMove(agent.id, dayIndex, e)}>
                                <div className="grid grid-cols-[repeat(24,minmax(28px,1fr))] gap-px min-w-[672px]">
                                  {Array.from({ length: 24 }).map((_, hour) => {
                                    const isAvailable = agentAvailability[agent.id]?.[`day${dayIndex}_hour${hour}`] !== false;
                                    return (
                                      <div key={hour} data-hour={hour}
                                        onMouseDown={(e) => handlePointerDown(agent.id, dayIndex, hour, e)}
                                        onMouseEnter={() => handlePointerEnter(agent.id, dayIndex, hour)}
                                        onTouchStart={(e) => handlePointerDown(agent.id, dayIndex, hour, e)}
                                        className={`h-8 cursor-pointer flex items-center justify-center text-[9px] font-bold select-none touch-none ${
                                          isAvailable ? 'bg-cyan-500/20 border-r border-cyan-500/30 text-cyan-400' : 'bg-pink-500/40 border-r border-pink-500/50 text-white'
                                        }`}>
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

          {/* FLEXIBILITY TAB */}
          {activeTab === 'flexibility' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-950 border border-dashed border-cyan-500/50">
                <h3 className="font-black text-cyan-400 text-base mb-2 uppercase tracking-widest">ALGORITHM v2.0</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  1. <span className="text-pink-500 font-bold">LIMITED</span> agents get extreme hours first.<br />
                  2. <span className="text-cyan-400 font-bold">FLEXIBLE</span> agents fill gaps.<br />
                  3. <span className="text-white font-bold">MAX CAP</span> is strictly enforced.
                </p>
              </div>
              {agents.length === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  <Award className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-bold uppercase tracking-wider">No agents to analyze</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map(agent => {
                    const stats = getAgentStats(agent.id);
                    const isLimited = stats.classification === 'limited';
                    return (
                      <div key={agent.id} className={`p-4 border-l-4 bg-slate-800/50 relative overflow-hidden ${isLimited ? 'border-pink-500' : 'border-cyan-500'}`}>
                        <div className="absolute top-0 right-0 p-2 opacity-10 font-black text-4xl text-white pointer-events-none">
                          {isLimited ? 'LTD' : 'FLX'}
                        </div>
                        <div className="flex justify-between items-start font-black text-lg text-white mb-3 relative z-10">
                          <span className="truncate mr-2">{agent.name}</span>
                          <span className={`text-[10px] py-0.5 px-1.5 border shrink-0 ${isLimited ? 'text-pink-500 border-pink-500' : 'text-cyan-500 border-cyan-500'}`}>
                            {isLimited ? '⚠️' : '⭐'}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs font-bold relative z-10">
                          <div className="flex justify-between text-slate-400"><span>AVAIL:</span> <span className="text-white">{stats.availableHours}H</span></div>
                          <div className="flex justify-between text-slate-400"><span>BLOCKED:</span> <span className="text-white">{stats.unavailableHours}H</span></div>
                          <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-700"><span>TARGET:</span> <span className="text-cyan-400">{stats.target}H</span></div>
                          <div className="flex justify-between text-slate-400"><span>MAX:</span> <span className="text-pink-500">{stats.max}H</span></div>
                          <div className="mt-3 pt-3 border-t border-slate-600 flex justify-between text-cyan-400">
                            <span>SCHEDULED:</span>
                            <span className={`text-lg ${stats.scheduledHours > stats.max ? 'text-red-500' : 'text-cyan-400'}`}>{stats.scheduledHours.toFixed(1)}H</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* HOOP TAB */}
          {activeTab === 'project' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2 p-3 bg-slate-950 border border-slate-800 text-[10px] font-bold uppercase">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-cyan-900/60 border border-cyan-500"></span> PRIME</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-pink-900/60 border border-pink-500"></span> EXTREME</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-900/60 border border-blue-500"></span> STANDARD</div>
              </div>
              {projectDays === 0 ? (
                <div className="text-center py-12 text-slate-600">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-bold uppercase tracking-wider">Set project dates first</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {Array.from({ length: projectDays }).map((_, dayIndex) => (
                    <div key={dayIndex} className="border border-slate-700 bg-slate-800/30 p-3">
                      <div className="font-bold text-slate-400 mb-2 text-[10px]">{getDateForDay(dayIndex)}</div>
                      <div className="overflow-x-auto touch-pan-x" onTouchMove={(e) => handleHOOPTouchMove(dayIndex, e)}>
                        <div className="grid grid-cols-[repeat(24,minmax(28px,1fr))] gap-0.5 min-w-[672px]">
                          {Array.from({ length: 24 }).map((_, h) => (
                            <button key={h} data-hour={h}
                              onMouseDown={(e) => handleHOOPPointerDown(dayIndex, h, e)}
                              onMouseEnter={() => handleHOOPPointerEnter(dayIndex, h)}
                              onTouchStart={(e) => handleHOOPPointerDown(dayIndex, h, e)}
                              className={`h-9 text-[9px] font-bold border touch-none ${
                                operatingHours[`day${dayIndex}_hour${h}`] ? getHourCategoryColor(h) : 'bg-slate-950 border-slate-800 text-slate-600'
                              }`}>
                              {h}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GENERATE TAB */}
          {activeTab === 'rules' && (
            <div className="flex flex-col items-center justify-center min-h-[350px] text-center px-4">
              <Cpu className="w-16 h-16 sm:w-24 sm:h-24 text-pink-500 mb-4 animate-pulse" />
              <h3 className="text-xl sm:text-3xl font-black text-white mb-3 tracking-wider uppercase">Ready to Compile</h3>
              <p className="max-w-md mx-auto text-cyan-400/70 mb-6 font-bold text-xs sm:text-base">
                INITIATING SCHEDULING ALGORITHM...<br />OPTIMIZING FOR TARGET HOURS...<br />ENFORCING MAX CAPS...
              </p>
              <button onClick={generateSchedule} disabled={agents.length === 0 || projectDays === 0}
                className="px-8 py-4 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider text-sm">
                GENERATE
              </button>
              {(agents.length === 0 || projectDays === 0) && (
                <p className="mt-4 text-xs text-slate-500 uppercase">{agents.length === 0 ? 'Add agents first' : 'Set project dates first'}</p>
              )}
            </div>
          )}

          {/* SCHEDULE TAB */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              {!generatedSchedule ? (
                <div className="text-center py-12 text-slate-600">
                  <Download className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="font-bold uppercase tracking-wider">No schedule generated</p>
                </div>
              ) : (
                <>
                  {scheduleAlerts.length > 0 && (
                    <div className="p-3 bg-pink-500/10 border border-pink-500 text-pink-500 font-bold text-[10px] uppercase space-y-1.5">
                      {scheduleAlerts.map((alert, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <span>{alert.message} ({getDateForDay(alert.day)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid gap-4">
                    {Object.entries(generatedSchedule).map(([day, data]) => (
                      <div key={day} className="border border-cyan-500/30 bg-slate-900/80 p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-500 to-cyan-500"></div>
                        <h4 className="font-black text-xl text-white mb-4 tracking-widest uppercase flex items-center gap-3">
                          {getDateForDay(parseInt(day))}<div className="h-px flex-1 bg-slate-800"></div>
                        </h4>
                        <div className="space-y-3">
                          {data.shifts.map((shift, i) => (
                            <div key={i} className="bg-slate-950 border border-slate-800 p-3">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 bg-slate-900 border border-slate-700"><Clock className="w-4 h-4 text-cyan-400" /></div>
                                  <div>
                                    <span className="font-black text-lg text-white block">{formatTime(shift.startHour)} - {formatTime(shift.endHour % 24)}</span>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                                      <span>{shift.hours.length}H</span>
                                      {shift.endDay > shift.startDay && <span className="text-pink-500 animate-pulse">OVERNIGHT</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1.5">
                                  {shift.hours.some(h => getHourCategory(h.hour) === 'hard') && <span className="text-[9px] bg-pink-900/50 text-pink-300 px-2 py-0.5 border border-pink-500/30 uppercase">Extreme</span>}
                                  {shift.hours.some(h => getHourCategory(h.hour) === 'prime') && <span className="text-[9px] bg-cyan-900/50 text-cyan-300 px-2 py-0.5 border border-cyan-500/30 uppercase">Prime</span>}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {shift.assignedDetails.map((d, idx) => (
                                  <span key={idx} className="inline-block bg-cyan-900/20 text-cyan-300 px-2 py-1 text-xs font-bold border border-cyan-500/30 uppercase">{d}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                          {data.shifts.length === 0 && <div className="text-slate-600 font-bold uppercase text-center py-4 border border-dashed border-slate-800 text-xs">NO OPS</div>}
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
