
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Wallet,
  Settings,
  Plus,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Menu,
  X,
  LogOut,
  User,
  Loader2,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/currency";

type Transaction = {
  id: string;
  title: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  transaction_date: string;
  note: string | null;
  created_at: string;
};

type MonthData = {
  month: string;
  year: number;
  monthIndex: number;
  income: number;
  expenses: number;
};

const categoryColors = [
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#38bdf8",
  "#c084fc",
  "#f97316",
  "#2dd4bf",
  "#a3e635",
  "#e879f9",
];

function getLastSixMonths(): MonthData[] {
  const result: MonthData[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    result.push({
      month: date.toLocaleDateString("en-IN", {
        month: "short",
      }),
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
      income: 0,
      expenses: 0,
    });
  }

  return result;
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const monthName = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return `${String(day).padStart(2, "0")} ${monthName[month - 1]} ${year}`;
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.replace("/login");
      return;
    }

    setUserEmail(userData.user.email ?? "");
    const savedCurrency = userData.user.user_metadata?.currency;
    setCurrencyCode(typeof savedCurrency === "string" && savedCurrency ? savedCurrency : "INR");

    const { data, error: fetchError } = await supabase
      .from("transactions")
      .select(
        "id, title, type, category, amount, transaction_date, note, created_at"
      )
      .eq("user_id", userData.user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTransactions((data ?? []) as Transaction[]);
      setError("");
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    setMonthlyData(getLastSixMonths());
    loadDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [loadDashboard, router, supabase]);

  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const balance = income - expenses;

  const chartData = monthlyData.map((month) => {
    const matchingTransactions = transactions.filter((item) => {
      const [year, monthNumber] = item.transaction_date
        .split("-")
        .map(Number);

      return (
        year === month.year &&
        monthNumber === month.monthIndex + 1
      );
    });

    return {
      ...month,
      income: matchingTransactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount), 0),

      expenses: matchingTransactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });

  const categoryTotals = transactions
    .filter((item) => item.type === "expense")
    .reduce((result, item) => {
      result[item.category] =
        (result[item.category] || 0) + Number(item.amount);

      return result;
    }, {} as Record<string, number>);

  const categoryData = Object.entries(categoryTotals)
    .map(([name, value], index) => ({
      name,
      value,
      color: categoryColors[index % categoryColors.length],
    }))
    .sort((a, b) => b.value - a.value);

  const recentTransactions = transactions.slice(0, 5);

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  function navigate(page: string) {
    const routes: Record<string, string> = {
      Dashboard: "/",
      Transactions: "/transactions",
      Analytics: "/analytics",
      Budgets: "/budgets",
      Settings: "/settings",
    };

    router.push(routes[page]);
    setSidebarOpen(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120] text-white">
        <div className="text-center">
          <Loader2
            className="mx-auto mb-4 animate-spin text-indigo-400"
            size={32}
          />
          <p className="text-sm text-slate-400">
            Loading your SpendWise dashboard...
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Transactions", icon: ArrowLeftRight },
    { name: "Analytics", icon: ChartNoAxesCombined },
    { name: "Budgets", icon: Wallet },
    { name: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100">

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-800 bg-[#111827] p-6 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <div className="rounded-xl bg-indigo-500 p-2">
              <IndianRupee size={22} />
            </div>
            SpendWise
          </div>

          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X />
          </button>
        </div>

        <nav className="space-y-2">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => navigate(name)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                name === "Dashboard"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={20} />
              {name}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-8 left-6 text-sm text-slate-500">
          SpendWise v1.0.0
        </div>
      </aside>

      <main className="min-h-screen p-5 lg:p-8">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu />
            </button>

            <div>
              <h1 className="text-2xl font-bold md:text-3xl">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Here's your financial overview.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 sm:flex">
              <User size={17} className="text-indigo-400" />
              <span className="max-w-40 truncate text-xs text-slate-400">
                {userEmail}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
            >
              <LogOut size={17} />
              {loggingOut ? "Logging out..." : "Logout"}
            </button>

            <button
              onClick={() => router.push("/transactions")}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium transition hover:bg-indigo-500"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add Transaction</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
            <button
              onClick={loadDashboard}
              className="ml-3 underline"
            >
              Retry
            </button>
          </div>
        )}

        <section className="mb-8 grid gap-5 md:grid-cols-3">

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Income</p>
              <TrendingUp className="text-emerald-400" size={24} />
            </div>
            <p className="text-3xl font-bold">{formatCurrency(income, currencyCode)}</p>
            <p className="mt-3 text-xs text-slate-500">
              All recorded income
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Expenses</p>
              <TrendingDown className="text-rose-400" size={24} />
            </div>
            <p className="text-3xl font-bold">{formatCurrency(expenses, currencyCode)}</p>
            <p className="mt-3 text-xs text-slate-500">
              All recorded expenses
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Current Balance</p>
              <Wallet className="text-indigo-400" size={24} />
            </div>
            <p className={`text-3xl font-bold ${balance < 0 ? "text-rose-400" : ""}`}>
              {formatCurrency(balance, currencyCode)}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Income minus expenses
            </p>
          </div>

        </section>

        <section className="mb-8 grid gap-6 xl:grid-cols-3">

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6 xl:col-span-2">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">
                Income vs Expenses
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Your last six calendar months
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid
                    stroke="#334155"
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="month"
                    stroke="#94a3b8"
                    tickLine={false}
                  />

                  <YAxis
                    stroke="#94a3b8"
                    tickLine={false}
                    tickFormatter={(value) => formatCurrency(Number(value), currencyCode)}
                  />

                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currencyCode)}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#34d399"
                    fill="#34d399"
                    fillOpacity={0.12}
                    strokeWidth={3}
                  />

                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#818cf8"
                    fill="#818cf8"
                    fillOpacity={0.12}
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex justify-center gap-6 text-sm">
              <span className="text-emerald-400">● Income</span>
              <span className="text-indigo-400">● Expenses</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <h2 className="text-lg font-semibold">
              Spending by Category
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              All recorded expenses
            </p>

            {categoryData.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <ChartNoAxesCombined
                  size={34}
                  className="mb-3 text-slate-600"
                />
                <p className="text-sm text-slate-400">
                  No expense data yet
                </p>
              </div>
            ) : (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {categoryData.map((item) => (
                          <Cell
                            key={item.name}
                            fill={item.color}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value), currencyCode)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="max-h-32 space-y-3 overflow-y-auto">
                  {categoryData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-2 text-slate-400">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </div>

                      <span className="font-medium">
                        {formatCurrency(item.value, currencyCode)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#151e30]">

          <div className="flex items-center justify-between border-b border-slate-800 p-6">
            <div>
              <h2 className="text-lg font-semibold">
                Recent Transactions
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Your latest financial activity
              </p>
            </div>

            <button
              onClick={() => router.push("/transactions")}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              View All →
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Wallet
                size={36}
                className="mx-auto mb-4 text-slate-600"
              />
              <h3 className="font-semibold">
                No transactions yet
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Start by adding your first income or expense.
              </p>

              <button
                onClick={() => router.push("/transactions")}
                className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium hover:bg-indigo-500"
              >
                Add Your First Transaction
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead className="bg-slate-800/40 text-sm text-slate-400">
                  <tr>
                    <th className="px-6 py-4">Transaction</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {recentTransactions.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-800 transition hover:bg-slate-800/20"
                    >
                      <td className="px-6 py-4 font-medium">
                        {item.title}
                      </td>

                      <td className="px-6 py-4 text-slate-400">
                        {item.category}
                      </td>

                      <td className="px-6 py-4 text-slate-400">
                        {formatDate(item.transaction_date)}
                      </td>

                      <td
                        className={`px-6 py-4 text-right font-semibold ${
                          item.type === "income"
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {item.type === "income" ? "+" : "-"}
                        {formatCurrency(Number(item.amount), currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </section>

        <footer className="mt-8 text-center text-xs text-slate-600">
          SpendWise v1.0.0 · Manage your money wisely.
        </footer>

      </main>
    </div>
  );
}
