
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Loader2,
  ChartNoAxesCombined,
  IndianRupee,
  RefreshCw,
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
  BarChart,
  Bar,
  Legend,
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
};

type MonthData = {
  month: string;
  year: number;
  monthIndex: number;
  income: number;
  expenses: number;
};

const colors = [
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

function getMonths(): MonthData[] {
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

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [currencyCode, setCurrencyCode] = useState("INR");

  const loadData = useCallback(async () => {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.replace("/login");
      return;
    }

    const savedCurrency = userData.user.user_metadata?.currency;
    setCurrencyCode(
      typeof savedCurrency === "string" && savedCurrency.trim()
        ? savedCurrency
        : "INR"
    );

    const { data, error: fetchError } = await supabase
      .from("transactions")
      .select("id, title, type, category, amount, transaction_date")
      .eq("user_id", userData.user.id)
      .order("transaction_date", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTransactions((data ?? []) as Transaction[]);
      setError("");
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    setMonths(getMonths());
    loadData();
  }, [loadData]);

  const filteredTransactions = useMemo(() => {
    if (period === "all") return transactions;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions.filter((item) => {
      const [year, month] = item.transaction_date
        .split("-")
        .map(Number);

      if (period === "month") {
        return month === currentMonth + 1 && year === currentYear;
      }

      if (period === "year") {
        return year === currentYear;
      }

      return true;
    });
  }, [transactions, period]);

  const totalIncome = filteredTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalExpenses = filteredTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const balance = totalIncome - totalExpenses;

  const savingsRate =
    totalIncome > 0
      ? (balance / totalIncome) * 100
      : 0;

  const monthlyChartData = months.map((month) => {
    const matching = transactions.filter((item) => {
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
      income: matching
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount), 0),
      expenses: matching
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });

  const categoryData = filteredTransactions
    .filter((item) => item.type === "expense")
    .reduce((result, item) => {
      result[item.category] =
        (result[item.category] || 0) + Number(item.amount);
      return result;
    }, {} as Record<string, number>);

  const pieData = Object.entries(categoryData)
    .map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.value - a.value);

  const comparisonData = [
    {
      name: "Income",
      amount: totalIncome,
    },
    {
      name: "Expenses",
      amount: totalExpenses,
    },
    {
      name: "Balance",
      amount: balance,
    },
  ];

  const topCategories = pieData.slice(0, 5);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120] text-white">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto mb-4 animate-spin text-indigo-400"
          />
          <p className="text-sm text-slate-400">
            Preparing your financial analytics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1120] p-5 text-slate-100 md:p-8">

      <div className="mx-auto max-w-7xl">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">

          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft size={17} />
              Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold">
              Financial Analytics
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Understand your financial habits and spending patterns.
            </p>
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Financial Overview</h2>
            <p className="mt-1 text-xs text-slate-500">
              Select a period for your summary cards and category analysis.
            </p>
          </div>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-xl border border-slate-700 bg-[#151e30] px-4 py-3 text-sm outline-none focus:border-indigo-500"
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>

        <section className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Income</p>
              <TrendingUp className="text-emerald-400" size={23} />
            </div>
            <h3 className="text-2xl font-bold">
              {formatCurrency(totalIncome, currencyCode)}
            </h3>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Expenses</p>
              <TrendingDown className="text-rose-400" size={23} />
            </div>
            <h3 className="text-2xl font-bold">
              {formatCurrency(totalExpenses, currencyCode)}
            </h3>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Net Balance</p>
              <Wallet className="text-indigo-400" size={23} />
            </div>
            <h3 className={`text-2xl font-bold ${balance < 0 ? "text-rose-400" : ""}`}>
              {formatCurrency(balance, currencyCode)}
            </h3>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Savings Rate</p>
              <PiggyBank className="text-amber-400" size={23} />
            </div>
            <h3 className={`text-2xl font-bold ${savingsRate < 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {savingsRate.toFixed(1)}%
            </h3>
          </div>

        </section>

        <section className="mb-8 grid gap-6 xl:grid-cols-3">

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6 xl:col-span-2">

            <h2 className="text-lg font-semibold">
              Monthly Income & Expenses
            </h2>

            <p className="mb-6 mt-1 text-xs text-slate-500">
              Six-month financial trend
            </p>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData}>

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
                    }}
                  />

                  <Legend />

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
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">

            <h2 className="text-lg font-semibold">
              Expense Breakdown
            </h2>

            <p className="mb-4 mt-1 text-xs text-slate-500">
              Category-wise spending
            </p>

            {pieData.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center text-center">
                <ChartNoAxesCombined
                  size={35}
                  className="mb-3 text-slate-600"
                />
                <p className="text-sm text-slate-400">
                  No expense data available
                </p>
              </div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={4}
                      >
                        {pieData.map((item) => (
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

                <div className="space-y-3">
                  {pieData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between text-sm"
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

        <section className="mb-8 rounded-2xl border border-slate-800 bg-[#151e30] p-6">

          <h2 className="text-lg font-semibold">
            Income vs Expense Comparison
          </h2>

          <p className="mb-6 mt-1 text-xs text-slate-500">
            Financial position for the selected period
          </p>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid
                  stroke="#334155"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis dataKey="name" stroke="#94a3b8" />

                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(value) => formatCurrency(Number(value), currencyCode)}
                />

                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), currencyCode)}
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                  }}
                />

                <Bar
                  dataKey="amount"
                  name="Amount"
                  radius={[8, 8, 0, 0]}
                >
                  {comparisonData.map((item) => (
                    <Cell
                      key={item.name}
                      fill={
                        item.name === "Income"
                          ? "#34d399"
                          : item.name === "Expenses"
                            ? "#fb7185"
                            : "#818cf8"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">

          <h2 className="mb-2 text-lg font-semibold">
            Top Spending Categories
          </h2>

          <p className="mb-6 text-xs text-slate-500">
            Your five highest expense categories
          </p>

          {topCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No spending categories available yet.
            </p>
          ) : (
            <div className="space-y-6">
              {topCategories.map((item) => {
                const percentage =
                  totalExpenses > 0
                    ? (item.value / totalExpenses) * 100
                    : 0;

                return (
                  <div key={item.name}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {item.name}
                      </span>

                      <span className="text-slate-400">
                        {formatCurrency(item.value, currencyCode)} · {percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </section>

        <footer className="mt-8 text-center text-xs text-slate-600">
          SpendWise v1.0.0 · Financial Analytics
        </footer>

      </div>
    </main>
  );
}
