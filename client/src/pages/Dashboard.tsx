import { StatCard } from "@/components/StatCard";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Users, Clock, Activity, Calendar, TrendingUp, CheckCircle2, ChevronRight, DollarSign, PieChart as PieChartIcon, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/loading";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid, PieChart, Pie, Legend } from "recharts";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const COLORS = ['#0d9488', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: [api.dashboard.stats.path],
    refetchInterval: 60000,
  });

  if (isLoading) return <Loading />;

  return (
    <>
      <PageHeader 
        title="Clinic Overview" 
        description="Real-time performance and patient flow analytics."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
        <StatCard
          title="Patients Today"
          value={stats?.dailyPatients || 0}
          icon={<Users className="w-6 h-6" />}
          color="teal"
        />
        <StatCard
          title="Completed Today"
          value={stats?.completedToday || 0}
          icon={<CheckCircle2 className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Avg Wait Time"
          value={`${stats?.avgWaitTime || 0}m`}
          icon={<Clock className="w-6 h-6" />}
          color="orange"
        />
        <StatCard
          title="Collected"
          value={`₹${Number(stats?.totalCollected || 0).toLocaleString('en-IN')}`}
          icon={<Wallet className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Pending"
          value={`₹${Number(stats?.totalPending || 0).toLocaleString('en-IN')}`}
          icon={<DollarSign className="w-6 h-6" />}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mt-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-display text-slate-900">Patient Volume (7 Days)</h3>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-full uppercase">Live</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.weeklyData || []}>
                <defs>
                  <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="patients" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorPatients)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold font-display text-slate-900 mb-6">Patient Acquisition</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.sourceDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats?.sourceDistribution?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold font-display text-slate-900 mb-6">Revenue Growth</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.weeklyData || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="revenue" name="Revenue (₹)" fill="#7c3aed" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold font-display text-slate-900 mb-6">Wait Time Trends</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.weeklyData || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="avgWait" name="Wait Time (m)" fill="#f97316" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mt-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold font-display text-slate-900">Active Doctor Queues</h3>
          <Link href="/queue">
            <Button variant="ghost" size="sm" className="text-teal-700 hover:text-teal-800 font-bold">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats?.activeQueues?.map((queue: any) => (
            <div key={queue.doctorId} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="font-semibold text-slate-900">{queue.doctorName}</p>
                <p className="text-sm text-slate-500">{queue.waitingCount} patients waiting</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-teal-700">{queue.currentWaitTime}m</p>
                <p className="text-xs text-slate-400">Est. Wait</p>
              </div>
            </div>
          ))}
          {(!stats?.activeQueues || stats.activeQueues.length === 0) && (
            <div className="text-center py-10 text-slate-400 col-span-full">No active queues right now.</div>
          )}
        </div>
      </div>
    </>
  );
}
