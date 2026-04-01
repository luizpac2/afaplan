import { useState, useMemo } from "react";
import { useCourseStore } from "../store/useCourseStore";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  BookOpen,
  Plane,
  Briefcase,
  Shield,
  Users,
  Filter,
  Search,
} from "lucide-react";

export const Cursos = () => {
  const { disciplines, updateDiscipline } = useCourseStore();
  const { userProfile } = useAuth();
  const { theme } = useTheme();
  const [selectedYear, setSelectedYear] = useState<"ALL" | number>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | string>(
    "ALL",
  );
  const [selectedTrainingField, setSelectedTrainingField] = useState<
    "ALL" | string
  >("ALL");

  // Intelligent filtering logic
  const filteredDisciplines = useMemo(() => {
    return disciplines.filter((d) => {
      const matchesSearch =
        searchTerm === "" ||
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "ALL" || d.category === selectedCategory;
      const matchesTrainingField =
        selectedTrainingField === "ALL" ||
        d.trainingField === selectedTrainingField;
      return matchesSearch && matchesCategory && matchesTrainingField;
    });
  }, [disciplines, searchTerm, selectedCategory, selectedTrainingField]);

  const canEdit = useMemo(() => {
    return ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role || "");
  }, [userProfile]);

  const getCategoryInfo = (category?: string) => {
    switch (category) {
      case "AVIATION":
        return {
          label: "Aviação (CFOAv) - Turmas A, B, C, D",
          icon: Plane,
          color:
            theme === "dark"
              ? "text-slate-300 bg-zinc-800/50 border border-zinc-700"
              : "text-zinc-700 bg-zinc-100 border border-zinc-200",
        };
      case "INTENDANCY":
        return {
          label: "Intendência (CFOInt) - Turma E",
          icon: Briefcase,
          color:
            theme === "dark"
              ? "text-amber-400 bg-amber-900/30 border border-amber-800/50"
              : "text-amber-600 bg-amber-100 border border-amber-200",
        };
      case "INFANTRY":
        return {
          label: "Infantaria (CFOInf) - Turma F",
          icon: Shield,
          color:
            theme === "dark"
              ? "text-orange-200 bg-amber-900/40 border border-amber-800"
              : "text-[#78350f] bg-[#78350f]/10 border border-[#78350f]/20",
        };
      default:
        return {
          label: "Formação Geral (Comum) - Todas as Turmas",
          icon: Users,
          color:
            theme === "dark"
              ? "text-slate-400 bg-slate-800 border border-slate-700"
              : "text-slate-600 bg-slate-100 border border-slate-200",
        };
    }
  };

  // Filter years
  const yearsToRender = selectedYear === "ALL" ? [1, 2, 3, 4] : [selectedYear];

  // Group disciplines by year and then by category
  const groupedDisciplines = useMemo(() => {
    return yearsToRender.map((year) => {
      const yearDisciplines = filteredDisciplines.filter(
        (d) =>
          d.year === year ||
          (d.enabledYears && d.enabledYears.includes(year as any)),
      );

      // Group by course type
      const byCategory = {
        AVIATION: yearDisciplines.filter(
          (d) =>
            d.category === "AVIATION" ||
            d.category === "COMMON" ||
            (d.enabledCourses && d.enabledCourses.includes("AVIATION")),
        ),
        INTENDANCY: yearDisciplines.filter(
          (d) =>
            d.category === "INTENDANCY" ||
            d.category === "COMMON" ||
            (d.enabledCourses && d.enabledCourses.includes("INTENDANCY")),
        ),
        INFANTRY: yearDisciplines.filter(
          (d) =>
            d.category === "INFANTRY" ||
            d.category === "COMMON" ||
            (d.enabledCourses && d.enabledCourses.includes("INFANTRY")),
        ),
      };

      const getLoadSum = (items: any[], courseFolder: string) => {
        return items.reduce((sum, d) => {
          const key = `${courseFolder}_${year}`;
          return sum + (d.ppcLoads?.[key] ?? d.load_hours ?? 0);
        }, 0);
      };

      const courseLoads = {
        AVIATION: getLoadSum(byCategory.AVIATION, "AVIATION"),
        INTENDANCY: getLoadSum(byCategory.INTENDANCY, "INTENDANCY"),
        INFANTRY: getLoadSum(byCategory.INFANTRY, "INFANTRY"),
      };

      // To simplify the UI, we just show the maximum load among the 3 courses as the "Total Acumulado" (or average), but it makes more sense to just show them individually.
      // For now, we'll keep `totalLoad` as the maximum of all courses to not confuse user with summed values.
      const totalLoad = Math.max(
        courseLoads.AVIATION,
        courseLoads.INTENDANCY,
        courseLoads.INFANTRY,
      );

      return {
        year,
        byCategory: {
          AVIATION: byCategory.AVIATION.sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR"),
          ),
          INTENDANCY: byCategory.INTENDANCY.sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR"),
          ),
          INFANTRY: byCategory.INFANTRY.sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR"),
          ),
        },
        totalLoad,
        courseLoads,
      };
    });
  }, [filteredDisciplines, yearsToRender]);

  // Get disciplines for ALL squadrons
  const allSquadronsDisciplines = useMemo(() => {
    return filteredDisciplines
      .filter((d) => d.year === "ALL")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [filteredDisciplines]);
  const allSquadronsLoad = allSquadronsDisciplines.reduce(
    (acc, curr) => acc + (curr.load_hours || 0),
    0,
  );
  const showAllSquadrons = selectedYear === "ALL";

  const handleLoadChange = (
    discipline: any,
    newLoad: string,
    courseName?: string,
    year?: number,
  ) => {
    const load = parseInt(newLoad) || 0;
    if (courseName && year) {
      const ppcLoads = discipline.ppcLoads || {};
      updateDiscipline(discipline.id, {
        ppcLoads: {
          ...ppcLoads,
          [`${courseName}_${year}`]: load,
        },
      });
    } else {
      updateDiscipline(discipline.id, { load_hours: load });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1
          className={`text-3xl  tracking-tight ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
        >
          PPC
        </h1>
        <p
          className={`mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
        >
          Definição da Carga Horária por Ano e Curso.
        </p>
      </div>

      {/* Filters */}
      <div
        className={`p-4 rounded-xl shadow-sm border mb-8 space-y-4 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`flex items-center gap-2  text-sm uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
          >
            <Filter size={18} />
            Busca Inteligente
          </div>

          <div className="flex-1 min-w-[300px] relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar por nome ou código da disciplina..."
              className={`w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500/20 ${theme === "dark" ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-900"}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <label
              className={`text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Esquadrão:
            </label>
            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(
                  e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                )
              }
              className={`px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${
                selectedYear === "ALL"
                  ? theme === "dark"
                    ? "border-slate-600 bg-slate-700 text-slate-100"
                    : "border-slate-200 bg-white"
                  : theme === "dark"
                    ? "border-blue-800 bg-blue-900/30 text-blue-300"
                    : "border-blue-300 bg-blue-50 text-blue-700 "
              }`}
            >
              <option value="ALL">Todos os Anos</option>
              <option value="1">1º Esquadrão (1º Ano)</option>
              <option value="2">2º Esquadrão (2º Ano)</option>
              <option value="3">3º Esquadrão (3º Ano)</option>
              <option value="4">4º Esquadrão (4º Ano)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label
              className={`text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Categoria:
            </label>
            <div
              className={`p-1 rounded-lg flex ${theme === "dark" ? "bg-slate-900" : "bg-slate-100"}`}
            >
              {[
                { id: "ALL", label: "Todas" },
                { id: "COMMON", label: "Comum" },
                { id: "AVIATION", label: "Aviação" },
                { id: "INTENDANCY", label: "Intendência" },
                { id: "INFANTRY", label: "Infantaria" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-md text-xs  transition-all ${
                    selectedCategory === cat.id
                      ? theme === "dark"
                        ? "bg-slate-700 text-white"
                        : "bg-white text-blue-600 shadow-sm"
                      : theme === "dark"
                        ? "text-slate-500 hover:text-slate-300"
                        : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label
              className={`text-xs  uppercase tracking-wider ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Campo:
            </label>
            <select
              value={selectedTrainingField}
              onChange={(e) => setSelectedTrainingField(e.target.value)}
              className={`px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-200"}`}
            >
              <option value="ALL">Todos os Campos</option>
              <option value="GERAL">Geral</option>
              <option value="MILITAR">Militar</option>
              <option value="PROFISSIONAL">Profissional</option>
              <option value="ATIVIDADES_COMPLEMENTARES">Complementares</option>
            </select>
          </div>

          {(selectedYear !== "ALL" ||
            selectedCategory !== "ALL" ||
            selectedTrainingField !== "ALL" ||
            searchTerm !== "") && (
            <button
              onClick={() => {
                setSelectedYear("ALL");
                setSelectedCategory("ALL");
                setSelectedTrainingField("ALL");
                setSearchTerm("");
              }}
              className="ml-auto text-xs  text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Filter size={14} />
              Limpar Todos os Filtros
            </button>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {/* ALL Squadrons Section - Only show if ALL is selected or explicitly relevant */}
        {showAllSquadrons && allSquadronsDisciplines.length > 0 && (
          <div
            className={`rounded-xl shadow-sm border-2 overflow-hidden ${theme === "dark" ? "bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-purple-800" : "bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200"}`}
          >
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Users className="text-white" size={20} />
                </div>
                <h2 className="text-xl  text-white">
                  Todos os Esquadrões (Disciplinas Comuns)
                </h2>
              </div>
              <div className="text-sm  text-purple-100">
                Total:{" "}
                <span className="text-white  ml-1">{allSquadronsLoad}h</span>
              </div>
            </div>

            <div className="p-6">
              <div
                className={`rounded-lg border overflow-hidden ${theme === "dark" ? "bg-slate-800 border-purple-800/50" : "bg-white border-purple-100"}`}
              >
                <table className="w-full text-sm">
                  <thead
                    className={` text-xs uppercase ${theme === "dark" ? "bg-purple-900/30 text-purple-300" : "bg-purple-100 text-purple-700"}`}
                  >
                    <tr>
                      <th className="px-4 py-2 text-left">Código</th>
                      <th className="px-4 py-2 text-left">Disciplina</th>
                      <th className="px-4 py-2 text-left">Categoria</th>
                      <th className="px-4 py-2 text-right w-24">Carga (h)</th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${theme === "dark" ? "divide-purple-800/30" : "divide-purple-100/50"}`}
                  >
                    {allSquadronsDisciplines.map((discipline) => {
                      const {
                        label,
                        icon: Icon,
                        color,
                      } = getCategoryInfo(discipline.category);
                      return (
                        <tr
                          key={discipline.id}
                          className={`transition-colors ${theme === "dark" ? "hover:bg-purple-900/10" : "hover:bg-purple-50"}`}
                        >
                          <td
                            className={`px-4 py-2 font-mono text-xs  ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`}
                          >
                            {discipline.code}
                          </td>
                          <td
                            className={`px-4 py-2  ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}
                          >
                            {discipline.name}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <div className={`p-1 rounded ${color}`}>
                                <Icon size={12} />
                              </div>
                              <span
                                className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                              >
                                {label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              disabled={!canEdit}
                              className={`w-16 px-2 py-1 text-right text-sm border rounded focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-mono ${theme === "dark" ? "bg-slate-700 text-slate-100 border-purple-700" : "border-purple-300"} ${!canEdit ? (theme === "dark" ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-500") : ""}`}
                              value={discipline.load_hours}
                              onChange={(e) =>
                                handleLoadChange(discipline, e.target.value)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {groupedDisciplines.map(({ year, byCategory, courseLoads }) => (
          <div
            key={year}
            className={`rounded-xl shadow-sm border overflow-hidden ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
          >
            <div
              className={`px-6 py-4 border-b flex justify-between items-center ${theme === "dark" ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/10 p-2 rounded-lg">
                  <BookOpen
                    className={
                      theme === "dark" ? "text-blue-400" : "text-blue-600"
                    }
                    size={20}
                  />
                </div>
                <h2
                  className={`text-xl  ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
                >
                  {year}º Esquadrão
                </h2>
              </div>
              <div
                className={`text-sm flex gap-4 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
              >
                <span
                  className={
                    theme === "dark" ? "text-slate-300" : "text-slate-700"
                  }
                  title="Carga Horária Aviação"
                >
                  <Plane size={14} className="inline mr-1" />
                  {courseLoads.AVIATION}h
                </span>
                <span
                  className={
                    theme === "dark" ? "text-amber-400" : "text-amber-700"
                  }
                  title="Carga Horária Intendência"
                >
                  <Briefcase size={14} className="inline mr-1" />
                  {courseLoads.INTENDANCY}h
                </span>
                <span
                  className={
                    theme === "dark" ? "text-orange-400" : "text-orange-700"
                  }
                  title="Carga Horária Infantaria"
                >
                  <Shield size={14} className="inline mr-1" />
                  {courseLoads.INFANTRY}h
                </span>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {Object.entries(byCategory).map(([category, items]) => {
                const { label, icon: Icon, color } = getCategoryInfo(category);

                return (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-md ${color}`}>
                        <Icon size={16} />
                      </div>
                      <h3 className=" text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">
                        {label}
                      </h3>
                    </div>

                    <div
                      className={`rounded-lg border overflow-hidden ${theme === "dark" ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}
                    >
                      <table className="w-full text-sm">
                        <thead
                          className={` text-xs uppercase ${theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}
                        >
                          <tr>
                            <th className="px-4 py-2 text-left">Código</th>
                            <th className="px-4 py-2 text-left">Disciplina</th>
                            <th className="px-4 py-2 text-right w-24">
                              Carga (h)
                            </th>
                          </tr>
                        </thead>
                        <tbody
                          className={`divide-y ${theme === "dark" ? "divide-slate-700/50" : "divide-slate-200/50"}`}
                        >
                          {items.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-3 text-center text-slate-400 italic text-xs"
                              >
                                Nenhuma disciplina cadastrada
                              </td>
                            </tr>
                          ) : (
                            items.map((discipline) => (
                              <tr
                                key={discipline.id}
                                className={`transition-colors ${theme === "dark" ? "hover:bg-slate-800" : "hover:bg-white"}`}
                              >
                                <td
                                  className={`px-4 py-2 font-mono text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                                >
                                  {discipline.code}
                                </td>
                                <td
                                  className={`px-4 py-2  ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}
                                >
                                  {discipline.name}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    disabled={!canEdit}
                                    className={`w-16 px-2 py-1 text-right text-sm border rounded focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono ${theme === "dark" ? "border-slate-600 bg-slate-700 text-slate-100" : "border-slate-300"} ${!canEdit ? (theme === "dark" ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-500") : ""}`}
                                    value={
                                      discipline.ppcLoads?.[
                                        `${category}_${year}`
                                      ] ??
                                      discipline.load_hours ??
                                      0
                                    }
                                    onChange={(e) =>
                                      handleLoadChange(
                                        discipline,
                                        e.target.value,
                                        category,
                                        year,
                                      )
                                    }
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
