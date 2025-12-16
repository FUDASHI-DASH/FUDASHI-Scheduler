import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, Users, Settings, Download, Plus, Trash2, AlertCircle, Award, MousePointerClick, Check, Upload, TrendingUp, Cpu, Terminal, Globe, Target, Ban } from 'lucide-react';

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
  const [collapsedHOOPDays, setCollapsedHOOPDays] = useState({});

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
          
          if (isAvailable) {
            availableCount++;
          } else {
            unavailableCount++;
          }
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
      ? Object.values(scores).reduce((sum, s) => sum + s.unavailableHours, 0) / agents.length 
      : 0;

    Object.keys(scores).forEach(agentId => {
      scores[agentId].classification = scores[agentId].unavailableHours > avgUnavailable ? 'limited' : 'flexible';
    });

    return scores;
  }, [agents, agentAvailability, projectDays]);

  // --- CRUD & Helper Functions ---
  const addAgent = () => {
    if (newAgentName.trim()) {
      const agentId = `agent_${Date.now()}`;
      const newAgent = { 
          id: agentId, 
          name: newAgentName.trim().toUpperCase(),
          target: 40, // Default Target
          max: 40     // Default Max
      };
      setAgents([...agents, newAgent]);
      setNewAgentName('');
    }
  };

  const updateAgentParams = (agentId, field, value) => {
      setAgents(prev => prev.map(a => 
          a.id === agentId ? { ...a, [field]: parseFloat(value) || 0 } : a
      ));
  };

  const removeAgent = (agentId) => {
    setAgents(agents.filter(a => a.id !== agentId));
    const newAvail = { ...agentAvailability };
    delete newAvail[agentId];
    setAgentAvailability(newAvail);
  };

  const toggleOperatingHour = (dayIndex, hour) => {
    const key = `day${dayIndex}_hour${hour}`;
    setOperatingHours(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateAvailability = (agentId, dayIndex, hour, available) => {
    const key = `day${dayIndex}_hour${hour}`;
    setAgentAvailability(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], [key]: available }
    }));
  };

  const toggleAgentCollapse = (agentId) => {
    setCollapsedAgents(prev => ({ ...prev, [agentId]: !prev[agentId] }));
  };

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
    // Find current agent object to get target/max
    const agentObj = agents.find(a => a.id === agentId) || { target: 40, max: 40 };
    
    return {
      availableHours: flex?.availableHours || 0,
      unavailableHours: flex?.unavailableHours || 0,
      scheduledHours: scheduledHours,
      flexibilityScore: flex?.flexibilityScore || 0,
      classification: flex?.classification || 'unknown',
      target: agentObj.target,
      max: agentObj.max
    };
  };

  const setDayAvailability = (agentId, dayIndex, available) => {
    const updates = {};
    for (let hour = 0; hour < 24; hour++) {
      updates[`day${dayIndex}_hour${hour}`] = available;
    }
    setAgentAvailability(prev => ({ ...prev, [agentId]: { ...prev[agentId], ...updates } }));
  };

  const handleMouseDown = (agentId, dayIndex, hour) => {
    setIsSelecting(true);
    setSelectionStart(hour);
    setCurrentAgent(agentId);
    setCurrentDay(dayIndex);
    const key = `day${dayIndex}_hour${hour}`;
    const currentValue = agentAvailability[agentId]?.[key] !== false;
    updateAvailability(agentId, dayIndex, hour, !currentValue);
  };

  const handleMouseEnter = (agentId, dayIndex, hour) => {
    if (isSelecting && agentId === currentAgent && dayIndex === currentDay && selectionStart !== null) {
      const start = Math.min(selectionStart, hour);
      const end = Math.max(selectionStart, hour);
      const targetValue = agentAvailability[agentId]?.[`day${dayIndex}_hour${selectionStart}`] !== false;
      for (let h = start; h <= end; h++) {
        updateAvailability(agentId, dayIndex, h, targetValue);
      }
    }
  };

  const handleMouseUp = () => { setIsSelecting(false); setSelectionStart(null); setCurrentAgent(null); setCurrentDay(null); };

  const handleHOOPMouseDown = (dayIndex, hour) => {
    setIsSelecting(true);
    setSelectionStart(hour);
    setCurrentDay(dayIndex);
    toggleOperatingHour(dayIndex, hour);
  };

  const handleHOOPMouseEnter = (dayIndex, hour) => {
    if (isSelecting && dayIndex === currentDay && selectionStart !== null) {
      const start = Math.min(selectionStart, hour);
      const end = Math.max(selectionStart, hour);
      const targetValue = operatingHours[`day${currentDay}_hour${selectionStart}`];
      for (let h = start; h <= end; h++) {
        setOperatingHours(prev => ({ ...prev, [`day${dayIndex}_hour${h}`]: targetValue }));
      }
    }
  };

  const getHourCategory = (hour) => {
    if (hour >= 18 || hour < 7) return 'hard'; 
    if (hour >= 9 && hour <= 16) return 'prime';
    return 'middle';
  };

  // --- REVISED ALGORITHM: STRICT TOTAL CAPS & TARGET PRIORITY ---
  const generateSchedule = () => {
    const schedule = {};
    const agentWeeklyHours = {};
    const agentTotalHours = {}; // New: Track cumulative hours for Max enforcement
    const agentShiftTracking = {}; 
    const alerts = [];
    
    agents.forEach(agent => {
      agentWeeklyHours[agent.id] = {}; 
      agentTotalHours[agent.id] = 0;
      agentShiftTracking[agent.id] = { lastShiftEnd: null, dailyHours: {} };
    });

    const getWeekKey = (day) => `Week_${Math.floor(day / 7)}`;

    // 1. Identify Global Shifts
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

    // 2. Process Shifts
    globalShifts.forEach(shift => {
        const shiftDuration = shift.hours.length;
        const lastSlot = shift.hours[shift.hours.length - 1];
        shift.endDay = lastSlot.day;
        shift.endHour = lastSlot.hour + 1; 
        const weekKey = getWeekKey(shift.startDay);

        if (shiftDuration < 3.5) {
          alerts.push({
            type: 'error',
            day: shift.startDay,
            shift: `${formatTime(shift.startHour)}-${formatTime(shift.endHour % 24)}`,
            message: `Shift duration ${shiftDuration}h is below minimum 3.5h. Cannot assign.`
          });
          shift.assignedDetails = ["UNFILLABLE (< 3.5h)"];
          shift.filled = false;
          schedule[shift.startDay].shifts.push(shift);
          return;
        }

        const assignments = [];
        const coveredIndices = new Set();

        // --- STEP 1: PLACE LIMITED AGENTS ---
        const limitedAgents = agents.filter(a => agentFlexibility[a.id].classification === 'limited');
        
        // Sort Limited by Target Gap (Need most hours first) then Availability Scarcity
        limitedAgents.sort((a, b) => {
            const gapA = a.target - agentTotalHours[a.id];
            const gapB = b.target - agentTotalHours[b.id];
            
            if (gapA !== gapB) return gapB - gapA; // Higher gap first
            return agentFlexibility[a.id].availableHours - agentFlexibility[b.id].availableHours;
        });
        
        limitedAgents.forEach(agent => {
            // MAX CHECK (TOTAL)
            const workedTotal = agentTotalHours[agent.id];
            if (workedTotal >= agent.max) return; 

            // Find valid block
            let startIdx = -1;
            let endIdx = -1;

            for(let i=0; i<shiftDuration; i++) {
                const h = shift.hours[i];
                const isAvail = agentAvailability[agent.id]?.[`day${h.day}_hour${h.hour}`] !== false;
                
                if (isAvail && !coveredIndices.has(i)) {
                    if (startIdx === -1) startIdx = i;
                    endIdx = i;
                } else if (startIdx !== -1) {
                    break; 
                }
            }

            if (startIdx !== -1) {
                let validStart = startIdx;
                let validEnd = endIdx + 1; 
                let duration = validEnd - validStart;

                // MAX CAP CLAMP (TOTAL)
                if (workedTotal + duration > agent.max) {
                    duration = agent.max - workedTotal;
                    validEnd = validStart + duration;
                }

                if (duration < 3.5) return; 

                // --- TRIM LOGIC ---
                const preGapSize = validStart; 
                if (preGapSize > 0 && preGapSize < 3.5) {
                    const shiftNeeded = 3.5 - preGapSize;
                    validStart += shiftNeeded; 
                }

                const postGapSize = shiftDuration - validEnd;
                if (postGapSize > 0 && postGapSize < 3.5) {
                    const shiftNeeded = 3.5 - postGapSize;
                    validEnd -= shiftNeeded; 
                }

                duration = validEnd - validStart;

                if (duration >= 3.5) {
                    if (duration > 8) {
                        validEnd = validStart + 8;
                        duration = 8;
                    }

                    // Double check max after trims
                    if (workedTotal + duration > agent.max) return; 

                    assignments.push({
                        agent,
                        startIndex: validStart, 
                        length: duration,
                        classification: 'limited'
                    });

                    for(let k=Math.ceil(validStart); k<Math.floor(validEnd); k++) {
                        coveredIndices.add(k);
                    }
                    
                    if (!agentWeeklyHours[agent.id][weekKey]) agentWeeklyHours[agent.id][weekKey] = 0;
                    agentWeeklyHours[agent.id][weekKey] += duration;
                    agentTotalHours[agent.id] += duration;
                }
            }
        });

        // --- STEP 2: FILL GAPS WITH FLEXIBLE AGENTS ---
        assignments.sort((a, b) => a.startIndex - b.startIndex);

        let currentTime = 0;
        const gaps = [];
        
        assignments.forEach(assign => {
            if (assign.startIndex > currentTime) {
                gaps.push({ start: currentTime, end: assign.startIndex });
            }
            currentTime = Math.max(currentTime, assign.startIndex + assign.length);
        });
        if (currentTime < shiftDuration) {
            gaps.push({ start: currentTime, end: shiftDuration });
        }

        gaps.forEach(gap => {
            let gapDuration = gap.end - gap.start;
            if (gapDuration < 0.1) return;

            const agentsNeeded = Math.ceil(gapDuration / 8);
            const hoursPerAgent = gapDuration / agentsNeeded;

            let chunkStart = gap.start;
            
            const flexibleAgents = agents.filter(a => agentFlexibility[a.id].classification !== 'limited');

            for (let i=0; i<agentsNeeded; i++) {
                let chunkLen = hoursPerAgent;
                chunkLen = Math.max(3.5, Math.min(8, chunkLen));
                if (chunkStart + chunkLen > gap.end) chunkLen = gap.end - chunkStart;

                // --- PRIORITY SORTING ---
                const midPoint = chunkStart + (chunkLen / 2);
                const midHour = shift.hours[Math.floor(midPoint)]?.hour || 12; 
                const isPrime = getHourCategory(midHour) === 'prime';

                flexibleAgents.sort((a, b) => {
                    const workedTotalA = agentTotalHours[a.id];
                    const workedTotalB = agentTotalHours[b.id];
                    const gapA = a.target - workedTotalA;
                    const gapB = b.target - workedTotalB;

                    // Priority 1: Target Gap (Biggest gap goes first)
                    // If target is met (gap <= 0), they drop in priority
                    if (gapA > 0 && gapB <= 0) return -1;
                    if (gapA <= 0 && gapB > 0) return 1;
                    if (gapA > 0 && gapB > 0 && Math.abs(gapA - gapB) > 2) return gapB - gapA;

                    // Priority 2: Contextual (Prime vs Hours)
                    if (isPrime) {
                        return agentFlexibility[b.id].flexibilityScore - agentFlexibility[a.id].flexibilityScore;
                    } else {
                        return workedTotalA - workedTotalB;
                    }
                });

                const checkStartHourIdx = Math.floor(chunkStart);
                const checkEndHourIdx = Math.ceil(chunkStart + chunkLen);
                const segmentHours = shift.hours.slice(checkStartHourIdx, checkEndHourIdx);
                
                const winner = flexibleAgents.find(agent => {
                    // MAX CHECK (TOTAL)
                    const workedTotal = agentTotalHours[agent.id];
                    if (workedTotal + chunkLen > agent.max) return false;

                    const isAvail = segmentHours.every(h => agentAvailability[agent.id]?.[`day${h.day}_hour${h.hour}`] !== false);
                    if (!isAvail) return false;
                    
                    // Weekly Check
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
                    assignments.push({
                        agent: winner,
                        startIndex: chunkStart,
                        length: chunkLen,
                        classification: 'flexible'
                    });
                    if (!agentWeeklyHours[winner.id][weekKey]) agentWeeklyHours[winner.id][weekKey] = 0;
                    agentWeeklyHours[winner.id][weekKey] += chunkLen;
                    agentTotalHours[winner.id] += chunkLen;
                    
                    segmentHours.forEach(h => {
                         if (!agentShiftTracking[winner.id].dailyHours[h.day]) agentShiftTracking[winner.id].dailyHours[h.day] = 0;
                         agentShiftTracking[winner.id].dailyHours[h.day] += (chunkLen / segmentHours.length);
                    });
                    
                    const startAbs = shift.hours[0].day * 24 + shift.hours[0].hour;
                    agentShiftTracking[winner.id].lastShiftEnd = startAbs + chunkStart + chunkLen;
                } else {
                    assignments.push({
                        agent: { name: "UNFILLED" },
                        startIndex: chunkStart,
                        length: chunkLen,
                        classification: 'unknown'
                    });
                }
                chunkStart += chunkLen;
            }
        });

        assignments.sort((a, b) => a.startIndex - b.startIndex);
        
        const totalCovered = assignments.filter(a => a.agent.name !== "UNFILLED").reduce((sum, a) => sum + a.length, 0);
        const isCovered = Math.abs(totalCovered - shiftDuration) < 0.1;

        if (!isCovered) {
             alerts.push({
                type: 'warning',
                day: shift.startDay,
                shift: `${formatTime(shift.startHour)}-${formatTime(shift.endHour % 24)}`,
                message: `Shift partially filled. Covered ${totalCovered.toFixed(1)}/${shiftDuration}h`
             });
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
    const newStats = { ...agentFlexibility };
    setHistoricalScores({ [new Date().toISOString()]: newStats });
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
    if (category === 'hard') return 'bg-pink-900/60 border-pink-500 text-pink-200 shadow-[0_0_8px_rgba(236,72,153,0.4)]';
    if (category === 'prime') return 'bg-cyan-900/60 border-cyan-500 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.4)]';
    return 'bg-blue-900/60 border-blue-500 text-blue-200 shadow-[0_0_8px_rgba(59,130,246,0.4)]';
  };

  return (
    <div className="min-h-screen bg-slate-950 font-mono text-cyan-400 p-6 selection:bg-pink-500 selection:text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-900 border-2 border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.3)] p-8 mb-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-scan.png')] opacity-20 pointer-events-none"></div>
          
          <div className="flex items-center gap-6 relative z-10">
            {/* FUDASHI LOGO */}
            <div className="relative group cursor-default">
                <div className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 via-cyan-500 to-blue-600 drop-shadow-[4px_4px_0px_rgba(236,72,153,1)] transform -skew-x-12 hover:skew-x-0 transition-transform duration-300">
                    FUDASHI
                </div>
                <div className="absolute top-0 left-0 w-full h-full bg-cyan-400/20 blur-xl -z-10 group-hover:bg-pink-500/30 transition-colors"></div>
            </div>
            
            <div className="h-16 w-1 bg-gradient-to-b from-pink-500 to-cyan-500 hidden md:block"></div>

            <div>
                <h2 className="text-4xl font-bold text-white tracking-[0.2em] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                    PHUTURE
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <Globe className="w-4 h-4 text-pink-500 animate-spin-slow" />
                    <p className="text-pink-500 font-bold tracking-[0.15em] text-sm uppercase glow-text">
                        EARTH IS STILL SPINNING
                    </p>
                </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-4 border border-cyan-500/30 p-2 bg-slate-950/50 backdrop-blur">
             <div className="text-right">
                <div className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest">System Status</div>
                <div className="text-xs text-cyan-400 font-bold tracking-wider animate-pulse">ONLINE // v2.4</div>
             </div>
             <div className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]"></div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-slate-900/80 border-b border-pink-500/30 mb-8 backdrop-blur-sm">
          <div className="flex overflow-x-auto no-scrollbar">
            {['agents', 'flexibility', 'project', 'rules', 'schedule'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-8 py-4 font-bold tracking-wider transition-all whitespace-nowrap border-b-4 ${
                  activeTab === tab 
                    ? 'text-white border-pink-500 bg-gradient-to-t from-pink-900/20 to-transparent shadow-[0_0_20px_rgba(236,72,153,0.2)]' 
                    : 'text-slate-500 border-transparent hover:text-cyan-400 hover:border-cyan-400/50'
                }`}
              >
                {tab === 'agents' && <Users className="w-5 h-5" />}
                {tab === 'flexibility' && <Award className="w-5 h-5" />}
                {tab === 'project' && <Clock className="w-5 h-5" />}
                {tab === 'rules' && <Settings className="w-5 h-5" />}
                {tab === 'schedule' && <Download className="w-5 h-5" />}
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-slate-900 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.05)] p-8 min-h-[600px] relative">
          
          {/* TAB: AGENTS */}
          {activeTab === 'agents' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-bold text-pink-500 mb-2 uppercase tracking-widest">Project Start [INIT]</label>
                  <input 
                    type="date" 
                    value={projectStartDate} 
                    onChange={(e) => setProjectStartDate(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-950 border border-cyan-500/30 text-cyan-400 focus:border-pink-500 focus:outline-none focus:shadow-[0_0_15px_rgba(236,72,153,0.4)] transition-all uppercase" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-pink-500 mb-2 uppercase tracking-widest">Project End [TERM]</label>
                  <input 
                    type="date" 
                    value={projectEndDate} 
                    onChange={(e) => setProjectEndDate(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-950 border border-cyan-500/30 text-cyan-400 focus:border-pink-500 focus:outline-none focus:shadow-[0_0_15px_rgba(236,72,153,0.4)] transition-all uppercase" 
                  />
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-slate-950/50 border border-dashed border-slate-700">
                <input 
                  type="text" 
                  value={newAgentName} 
                  onChange={(e) => setNewAgentName(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && addAgent()}
                  placeholder="ENTER AGENT ID..."
                  className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none uppercase"
                />
                <button onClick={addAgent} className="flex items-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-black font-black uppercase tracking-widest border-b-4 border-cyan-800 active:border-b-0 active:translate-y-1 transition-all">
                  <Plus className="w-5 h-5" /> ADD
                </button>
              </div>

              {agents.map(agent => {
                const isCollapsed = collapsedAgents[agent.id];
                const availabilityPercent = getAgentAvailabilityPercentage(agent.id);
                
                return (
                  <div key={agent.id} className="border border-slate-700 bg-slate-800/50 p-4 hover:border-pink-500/50 transition-colors group">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
                        <div className="font-bold text-xl text-white tracking-wide">{agent.name}</div>
                        {isCollapsed && (
                          <span className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 text-xs font-bold tracking-wider">
                            <Check className="w-3 h-3" />
                            {availabilityPercent}% AVAIL
                          </span>
                        )}
                      </div>
                      
                      <div className="flex gap-4 flex-wrap">
                         <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-cyan-500 uppercase">Target (H)</label>
                            <input 
                                type="number" 
                                value={agent.target || 40}
                                onChange={(e) => updateAgentParams(agent.id, 'target', e.target.value)}
                                className="w-16 px-2 py-1 bg-slate-900 border border-cyan-500/50 text-cyan-400 text-xs font-bold focus:outline-none focus:border-pink-500"
                            />
                         </div>
                         <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-pink-500 uppercase">Max (H)</label>
                            <input 
                                type="number" 
                                value={agent.max || 40}
                                onChange={(e) => updateAgentParams(agent.id, 'max', e.target.value)}
                                className="w-16 px-2 py-1 bg-slate-900 border border-pink-500/50 text-pink-400 text-xs font-bold focus:outline-none focus:border-cyan-500"
                            />
                         </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => toggleAgentCollapse(agent.id)} 
                          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border ${
                            isCollapsed
                              ? 'border-pink-500 text-pink-500 hover:bg-pink-500/10'
                              : 'bg-cyan-600 text-black border-cyan-600 hover:bg-cyan-500'
                          }`}
                        >
                          {isCollapsed ? 'EDIT DATA' : 'CONFIRM'}
                        </button>
                        <button onClick={() => removeAgent(agent.id)} className="text-slate-600 hover:text-pink-500 transition-colors p-2"><Trash2 size={20}/></button>
                      </div>
                    </div>
                    
                    {!isCollapsed && (
                      <div className="animate-in slide-in-from-top-4 duration-300">
                        <p className="text-xs text-slate-400 mb-4 font-bold tracking-widest uppercase">
                          <span className="text-cyan-400">■ AVAILABLE</span> / <span className="text-pink-500">■ UNAVAILABLE</span> - CLICK & DRAG TO BLOCK HOURS
                        </p>
                        <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                          {Array.from({ length: projectDays }).map((_, dayIndex) => {
                            return (
                              <div key={dayIndex} className="bg-slate-950 p-2 border border-slate-800 flex items-center gap-4">
                                <div className="w-32 text-xs font-bold text-slate-400 shrink-0">{getDateForDay(dayIndex)}</div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => setDayAvailability(agent.id, dayIndex, true)} className="text-[10px] text-cyan-500 hover:underline">ALL</button>
                                    <button onClick={() => setDayAvailability(agent.id, dayIndex, false)} className="text-[10px] text-pink-500 hover:underline">NONE</button>
                                </div>
                                <div 
                                  className="flex-1 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-px"
                                  onMouseUp={handleMouseUp}
                                  onMouseLeave={handleMouseUp}
                                >
                                  {Array.from({ length: 24 }).map((_, hour) => {
                                    const isAvailable = agentAvailability[agent.id]?.[`day${dayIndex}_hour${hour}`] !== false;
                                    return (
                                      <div
                                        key={hour}
                                        onMouseDown={() => handleMouseDown(agent.id, dayIndex, hour)}
                                        onMouseEnter={() => handleMouseEnter(agent.id, dayIndex, hour)}
                                        title={`${formatTime(hour)}`}
                                        className={`h-8 cursor-pointer transition-all flex items-center justify-center text-[10px] font-bold select-none ${
                                          isAvailable 
                                            ? 'bg-cyan-500/20 border-r border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/40' 
                                            : 'bg-pink-500/40 border-r border-pink-500/50 text-white hover:bg-pink-500/60'
                                        }`}
                                      >
                                        {hour}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: FLEXIBILITY */}
          {activeTab === 'flexibility' && (
             <div className="space-y-8 animate-in fade-in duration-500">
                <div className="p-6 bg-slate-950 border border-dashed border-cyan-500/50">
                   <h3 className="font-black text-cyan-400 text-lg mb-2 uppercase tracking-widest">ALGORITHM LOGIC v2.0</h3>
                   <p className="text-sm text-slate-400">
                      1. <span className="text-pink-500 font-bold">LIMITED AGENTS</span> GET EXTREME HOURS FIRST IF BELOW TARGET.<br/>
                      2. <span className="text-cyan-400 font-bold">FLEXIBLE AGENTS</span> FILL GAPS, PRIORITIZING PRIME HOURS IF BELOW TARGET.<br/>
                      3. <span className="text-white font-bold">MAX CAP</span> IS STRICTLY ENFORCED.
                   </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {agents.map(agent => {
                      const stats = getAgentStats(agent.id);
                      const isLimited = stats.classification === 'limited';
                      return (
                        <div key={agent.id} className={`p-6 border-l-4 bg-slate-800/50 backdrop-blur-sm relative overflow-hidden ${isLimited ? 'border-pink-500' : 'border-cyan-500'}`}>
                           <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-white select-none pointer-events-none">
                                {isLimited ? 'LTD' : 'FLX'}
                           </div>
                           <div className="flex justify-between font-black text-xl text-white mb-4 tracking-widest relative z-10">
                              {agent.name}
                              <span className={`text-sm py-1 px-2 border ${isLimited ? 'text-pink-500 border-pink-500' : 'text-cyan-500 border-cyan-500'}`}>
                                {isLimited ? '⚠️ LIMITED' : '⭐ FLEXIBLE'}
                              </span>
                           </div>
                           <div className="space-y-2 text-sm font-bold relative z-10">
                              <div className="flex justify-between text-slate-400"><span>AVAILABILITY:</span> <span className="text-white">{stats.availableHours}H</span></div>
                              <div className="flex justify-between text-slate-400"><span>BLOCKED:</span> <span className="text-white">{stats.unavailableHours}H</span></div>
                              <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-700">
                                  <span>TARGET:</span> <span className="text-cyan-400">{stats.target}H</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                  <span>MAX:</span> <span className="text-pink-500">{stats.max}H</span>
                              </div>
                              <div className="mt-4 pt-4 border-t border-slate-600 flex justify-between text-cyan-400">
                                <span>SCHEDULED:</span> 
                                <span className={`text-xl ${stats.scheduledHours > stats.max ? 'text-red-500' : 'text-cyan-400'}`}>
                                    {stats.scheduledHours.toFixed(1)}H
                                </span>
                              </div>
                           </div>
                        </div>
                      )
                   })}
                </div>
             </div>
          )}

          {/* TAB: PROJECT HOOP */}
          {activeTab === 'project' && (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="flex gap-4 p-4 bg-slate-950 border border-slate-800 text-xs font-bold tracking-widest uppercase">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-cyan-900/60 border border-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]"></span> PRIME (09-16)</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-pink-900/60 border border-pink-500 shadow-[0_0_5px_rgba(236,72,153,0.5)]"></span> EXTREME (00-07, 18-24)</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-900/60 border border-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span> STANDARD</div>
               </div>

               {projectDays > 0 && (
                <div className="flex justify-end gap-4">
                    <button className="text-xs text-cyan-500 hover:text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-2 border border-cyan-500/30 px-3 py-1 hover:bg-cyan-500/10 transition-colors">
                        <Upload size={14} /> Upload HOOP CSV
                    </button>
                </div>
               )}

               <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
               {Array.from({ length: projectDays }).map((_, dayIndex) => (
                  <div key={dayIndex} className="border border-slate-700 bg-slate-800/30 p-4">
                     <div className="font-bold text-slate-400 mb-2 tracking-widest text-xs">{getDateForDay(dayIndex)}</div>
                     <div 
                        className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1"
                        onMouseUp={handleMouseUp} 
                        onMouseLeave={handleMouseUp}
                      >
                        {Array.from({ length: 24 }).map((_, h) => (
                           <button
                             key={h}
                             onMouseDown={() => handleHOOPMouseDown(dayIndex, h)}
                             onMouseEnter={() => handleHOOPMouseEnter(dayIndex, h)}
                             className={`h-10 text-[10px] font-bold transition-all border ${
                                operatingHours[`day${dayIndex}_hour${h}`] 
                                ? getHourCategoryColor(h) 
                                : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-cyan-500/30'
                             }`}
                           >
                              {h}H
                           </button>
                        ))}
                     </div>
                  </div>
               ))}
               </div>
            </div>
          )}

          {/* TAB: RULES */}
          {activeTab === 'rules' && (
             <div className="flex flex-col items-center justify-center min-h-[400px] text-center animate-in zoom-in duration-300">
                <Cpu className="w-24 h-24 text-pink-500 mb-6 animate-pulse" />
                <h3 className="text-3xl font-black text-white mb-4 tracking-[0.2em] uppercase">Ready to Compile</h3>
                <p className="max-w-md mx-auto text-cyan-400/70 mb-8 font-bold tracking-wider leading-relaxed">
                   INITIATING SCHEDULING ALGORITHM...<br/>
                   OPTIMIZING FOR TARGET HOURS...<br/>
                   ENFORCING MAX CAPS...
                </p>
                <button 
                  onClick={generateSchedule}
                  disabled={agents.length === 0 || projectDays === 0}
                  className="group relative px-12 py-6 bg-pink-600 hover:bg-pink-500 text-white font-black uppercase tracking-[0.2em] overflow-hidden transition-all clip-path-polygon"
                >
                   <span className="relative z-10 group-hover:scale-110 block transition-transform">GENERATE SCHEDULE</span>
                   <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
             </div>
          )}

          {/* TAB: SCHEDULE */}
          {activeTab === 'schedule' && generatedSchedule && (
             <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                {scheduleAlerts.length > 0 && (
                   <div className="p-4 bg-pink-500/10 border border-pink-500 text-pink-500 font-bold text-xs uppercase tracking-wider space-y-2">
                      {scheduleAlerts.map((alert, i) => (
                         <div key={i} className="flex items-center gap-2">
                            <AlertCircle size={14} />
                            <span>{alert.message} ({getDateForDay(alert.day)})</span>
                         </div>
                      ))}
                   </div>
                )}
                
                <div className="grid gap-6">
                {Object.entries(generatedSchedule).map(([day, data]) => (
                   <div key={day} className="border border-cyan-500/30 bg-slate-900/80 p-6 relative overflow-hidden">
                      {/* Decorative background line */}
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-500 to-cyan-500"></div>
                      
                      <h4 className="font-black text-2xl text-white mb-6 tracking-widest uppercase flex items-center gap-4">
                        {getDateForDay(parseInt(day))}
                        <div className="h-px flex-1 bg-slate-800"></div>
                      </h4>
                      
                      <div className="space-y-4">
                         {data.shifts.map((shift, i) => (
                            <div key={i} className="bg-slate-950 border border-slate-800 p-4 hover:border-pink-500/50 transition-colors group relative">
                               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                  <div className="flex items-center gap-4">
                                     <div className="p-2 bg-slate-900 border border-slate-700">
                                        <Clock className="w-5 h-5 text-cyan-400" />
                                     </div>
                                     <div>
                                         <span className="font-black text-xl text-white block">
                                           {formatTime(shift.startHour)} - {formatTime(shift.endHour % 24)}
                                         </span>
                                         <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <span>DURATION: {shift.hours.length}H</span>
                                            {shift.endDay > shift.startDay && (
                                               <span className="text-pink-500 ml-2 animate-pulse">
                                                 (+1 DAY OVERNIGHT)
                                               </span>
                                            )}
                                         </div>
                                     </div>
                                  </div>
                                  <div className="flex gap-2">
                                     {shift.hours.some(h => getHourCategory(h.hour) === 'hard') && <span className="text-[10px] bg-pink-900/50 text-pink-300 px-3 py-1 border border-pink-500/30 uppercase tracking-widest">Extreme</span>}
                                     {shift.hours.some(h => getHourCategory(h.hour) === 'prime') && <span className="text-[10px] bg-cyan-900/50 text-cyan-300 px-3 py-1 border border-cyan-500/30 uppercase tracking-widest">Prime</span>}
                                  </div>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                  {shift.assignedDetails.map((d, idx) => (
                                     <span key={idx} className="inline-block bg-cyan-900/20 text-cyan-300 px-4 py-2 text-sm font-bold border border-cyan-500/30 uppercase tracking-wide">
                                        {d}
                                     </span>
                                  ))}
                               </div>
                            </div>
                         ))}
                         {data.shifts.length === 0 && <div className="text-slate-600 font-bold uppercase tracking-widest text-center py-4 border border-dashed border-slate-800">NO OPS</div>}
                      </div>
                   </div>
                ))}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
