"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Wallet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
  PiggyBank,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/currency";

type Budget = {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  month: number;
  year: number;
};

type Transaction = {
  id: string;
  category: string;
  type: "income" | "expense";
  amount: number;
  transaction_date: string;
};

const categories = [
  "Food",
  "Shopping",
  "Transport",
  "Bills",
  "Education",
  "Entertainment",
  "Health",
  "Rent",
  "Other",
];

export default function BudgetsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    category: "Food",
    monthly_limit: "",
  });

  const loadData = useCallback(async () => {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.replace("/login");
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    setUserId(userData.user.id);
    const savedCurrency = userData.user.user_metadata?.currency;
    setCurrencyCode(
      typeof savedCurrency === "string" && savedCurrency.trim()
        ? savedCurrency
        : "INR"
    );
    setMonth(currentMonth);
    setYear(currentYear);

    const startDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const endDate = new Date(
      currentYear,
      currentMonth,
      0
    ).getDate();

    const endDateString =
      `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;

    const [budgetResult, transactionResult] = await Promise.all([
      supabase
        .from("budgets")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .order("category"),

      supabase
        .from("transactions")
        .select("id, category, type, amount, transaction_date")
        .eq("user_id", userData.user.id)
        .eq("type", "expense")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDateString),
    ]);

    if (budgetResult.error) {
      setError(budgetResult.error.message);
    } else if (transactionResult.error) {
      setError(transactionResult.error.message);
    } else {
      setBudgets((budgetResult.data ?? []) as Budget[]);
      setTransactions((transactionResult.data ?? []) as Transaction[]);
      setError("");
    }

    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalBudget = budgets.reduce(
    (sum, item) => sum + Number(item.monthly_limit),
    0
  );

  const totalSpent = transactions.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  const remaining = totalBudget - totalSpent;

  const totalPercentage =
    totalBudget > 0
      ? (totalSpent / totalBudget) * 100
      : 0;

  const monthName =
    month !== null
      ? new Date(2000, month - 1, 1).toLocaleDateString("en-IN", {
          month: "long",
        })
      : "";

  function getSpent(category: string) {
    return transactions
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + Number(item.amount), 0);
  }

  function openAddModal() {
    setEditingId(null);
    setForm({
      category:
        categories.find(
          (category) =>
            !budgets.some((budget) => budget.category === category)
        ) ?? "Food",
      monthly_limit: "",
    });
    setError("");
    setModalOpen(true);
  }

  function openEditModal(budget: Budget) {
    setEditingId(budget.id);
    setForm({
      category: budget.category,
      monthly_limit: String(budget.monthly_limit),
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const amount = Number(form.monthly_limit);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid budget amount greater than zero.");
      return;
    }

    if (month === null || year === null || !userId) {
      setError("Please wait for the page to finish loading.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      user_id: userId,
      category: form.category,
      monthly_limit: amount,
      month,
      year,
    };

    const result = editingId
      ? await supabase
          .from("budgets")
          .update({
            category: payload.category,
            monthly_limit: payload.monthly_limit,
          })
          .eq("id", editingId)
          .eq("user_id", userId)
      : await supabase
          .from("budgets")
          .upsert(payload, {
            onConflict: "user_id,category,month,year",
          });

    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "A budget for this category already exists."
          : result.error.message
      );
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setSaving(false);
    await loadData();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this category budget?")) return;

    const { error: deleteError } = await supabase
      .from("budgets")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadData();
  }

  function getProgressColor(percentage: number) {
    if (percentage >= 100) return "#f43f5e";
    if (percentage >= 80) return "#fbbf24";
    return "#818cf8";
  }

  function getStatus(percentage: number) {
    if (percentage >= 100) return "Budget exceeded";
    if (percentage >= 80) return "Near budget limit";
    return "Within budget";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120] text-white">
        <div className="text-center">
          <Loader2
            size={32}
            className="mx-auto mb-4 animate-spin text-indigo-400"
          />
          <p className="text-sm text-slate-400">
            Loading your budgets...
          </p>
        </div>
      </div>
    );
  }

  const availableCategories = categories.filter(
    (category) =>
      editingId
        ? true
        : !budgets.some((budget) => budget.category === category)
  );

  return (
    <main className="min-h-screen bg-[#0b1120] px-4 py-6 text-slate-100 md:px-8">

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
              Budget Management
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Plan your spending and stay in control of your money.
            </p>

            <p className="mt-2 text-sm font-medium text-indigo-400">
              {monthName} {year}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadData}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              onClick={openAddModal}
              disabled={budgets.length >= categories.length}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={18} />
              Add Budget
            </button>
          </div>

        </header>

        {error && !modalOpen && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        <section className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Budget</p>
              <Wallet className="text-indigo-400" size={23} />
            </div>
            <h2 className="text-2xl font-bold">
              {formatCurrency(totalBudget, currencyCode)}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">Total Spent</p>
              <TrendingDown className="text-rose-400" size={23} />
            </div>
            <h2 className="text-2xl font-bold">
              {formatCurrency(totalSpent, currencyCode)}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">Remaining Budget</p>
              <PiggyBank className="text-emerald-400" size={23} />
            </div>
            <h2 className={`text-2xl font-bold ${remaining < 0 ? "text-rose-400" : ""}`}>
              {formatCurrency(Math.abs(remaining), currencyCode)}
              {remaining < 0 && (
                <span className="ml-2 text-xs">over</span>
              )}
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#151e30] p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">Overall Usage</p>
              <Wallet className="text-amber-400" size={23} />
            </div>
            <h2 className="text-2xl font-bold">
              {totalPercentage.toFixed(1)}%
            </h2>
          </div>

        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-[#151e30] p-6">

          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Overall Budget Progress
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Combined spending across your budget categories
              </p>
            </div>

            {totalBudget > 0 && (
              totalPercentage >= 100 ? (
                <AlertTriangle className="text-rose-400" />
              ) : (
                <CheckCircle2 className="text-emerald-400" />
              )
            )}
          </div>

          <div className="mb-3 flex justify-between text-sm">
            <span className="text-slate-400">
              {formatCurrency(totalSpent, currencyCode)} spent
            </span>
            <span className="text-slate-400">
              {formatCurrency(totalBudget, currencyCode)} limit
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(totalPercentage, 100)}%`,
                backgroundColor: getProgressColor(totalPercentage),
              }}
            />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            {totalBudget === 0
              ? "Create your first budget to track spending."
              : totalPercentage >= 100
                ? "Your combined spending has reached or exceeded your budget."
                : `${(100 - totalPercentage).toFixed(1)}% of your combined budget remains.`}
          </p>

        </section>

        <section>

          <div className="mb-5">
            <h2 className="text-xl font-semibold">
              Category Budgets
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Monitor your spending category by category.
            </p>
          </div>

          {budgets.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#151e30] px-6 py-20 text-center">
              <PiggyBank
                size={42}
                className="mx-auto mb-4 text-indigo-400"
              />
              <h3 className="text-lg font-semibold">
                No budgets created yet
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Set your first monthly category budget to start tracking.
              </p>
              <button
                onClick={openAddModal}
                className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium hover:bg-indigo-500"
              >
                Create Your First Budget
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

              {budgets.map((budget) => {
                const spent = getSpent(budget.category);
                const limit = Number(budget.monthly_limit);
                const percentage =
                  limit > 0 ? (spent / limit) * 100 : 0;
                const progressColor = getProgressColor(percentage);

                return (
                  <div
                    key={budget.id}
                    className="rounded-2xl border border-slate-800 bg-[#151e30] p-6"
                  >
                    <div className="mb-5 flex items-start justify-between">

                      <div>
                        <h3 className="text-lg font-semibold">
                          {budget.category}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Monthly spending limit
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(budget)}
                          aria-label="Edit budget"
                          className="rounded-lg p-2 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          onClick={() => handleDelete(budget.id)}
                          aria-label="Delete budget"
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>

                    </div>

                    <div className="mb-4 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-500">
                          Amount spent
                        </p>
                        <p className="mt-1 text-xl font-bold">
                          {formatCurrency(spent, currencyCode)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          Budget limit
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {formatCurrency(limit, currencyCode)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: progressColor,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-medium"
                        style={{ color: progressColor }}
                      >
                        {getStatus(percentage)}
                      </span>

                      <span className="text-xs text-slate-400">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-4 border-t border-slate-800 pt-4">
                      <p className="text-sm text-slate-400">
                        {spent > limit
                          ? `${formatCurrency(spent - limit, currencyCode)} over budget`
                          : `${formatCurrency(limit - spent, currencyCode)} remaining`}
                      </p>
                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </section>

        <footer className="mt-10 text-center text-xs text-slate-600">
          SpendWise v1.0.0 · Budget Management
        </footer>

      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">

          <div className="my-auto w-full max-w-md rounded-2xl border border-slate-700 bg-[#151e30] p-6 shadow-2xl">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId ? "Edit Budget" : "Create Budget"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Set your monthly spending limit.
                </p>
              </div>

              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close form"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Category
                </label>

                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  disabled={!!editingId}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b1120] px-4 py-3 text-sm outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Monthly Limit ({currencyCode})
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    {currencyCode}
                  </span>

                  <input
                    required
                    type="number"
                    min="0.01"
                    max="9999999999.99"
                    step="0.01"
                    value={form.monthly_limit}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        monthly_limit: e.target.value,
                      })
                    }
                    placeholder="Enter monthly limit"
                    className="w-full rounded-xl border border-slate-700 bg-[#0b1120] py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-800/60 p-4 text-sm text-slate-400">
                This budget applies to {monthName} {year}.
                Spending is calculated automatically from your expense transactions.
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-slate-700 py-3 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving && (
                    <Loader2 size={17} className="animate-spin" />
                  )}
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Budget"
                      : "Save Budget"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </main>
  );
}
