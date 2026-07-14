export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">方法论 · Methodology</h1>
      <p className="text-sm text-[var(--muted)] mb-8">
        数据截至 2026-07 · AI 推断仅供参考，非博彩建议
        <br />
        Data as of 2026-07 — AI inference for reference only, not betting advice.
      </p>

      <div className="card p-6 mb-6 border-amber-500/30 bg-amber-500/5">
        <h2 className="text-sm font-semibold text-amber-300 mb-2">⚠️ 重要声明 / Disclaimer</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          WC2030 Scout 是一个<strong className="text-[var(--foreground)]">开放的公共体育知识引擎</strong>
          （open public sports knowledge engine），目的是探索大语言模型对公开体育数据的分析与推理能力。
          所有概率数字均为 AI 模型基于公开信息的<strong className="text-[var(--foreground)]">主观估计</strong>，
          <strong className="text-[var(--foreground)]">不构成任何形式的博彩建议、投注依据或专业预测保证</strong>。
          请勿将本站内容用于任何博彩或金融决策。
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">数据来源 · Data Sources</h2>
        <ul className="text-sm text-[var(--muted)] leading-relaxed list-disc pl-5 space-y-1">
          <li>2026年世界杯官方/公开报道的10支国家队26人大名单（球员姓名、位置、出生年份、俱乐部、联赛、出场数、进球数）</li>
          <li>来源：Wikipedia 2026 FIFA World Cup squads 页面整理</li>
          <li>球员近期动态：DuckDuckGo 公开网页搜索结果摘要（非付费/非独家数据源）</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">模型流程 · Model Process</h2>
        <ol className="text-sm text-[var(--muted)] leading-relaxed list-decimal pl-5 space-y-2">
          <li>
            <strong className="text-[var(--foreground)]">结构化 Prompt：</strong>
            对每位球员，将年龄（2030年时）、位置职业生涯纵深规律、俱乐部/联赛水平、国家队经验（出场/进球）
            组装为结构化提示词。
          </li>
          <li>
            <strong className="text-[var(--foreground)]">双模型独立推断：</strong>
            通过 GonkaRouter 分别调用 <code className="pill px-1">Kimi K2.6</code> 与{" "}
            <code className="pill px-1">MiniMax M2.7</code>，两模型互不知晓对方输出，独立给出
            0-100 的「2030年留队概率」及简要理由。
          </li>
          <li>
            <strong className="text-[var(--foreground)]">交叉验证：</strong>
            取两模型均值作为展示概率，计算分歧度（divergence = |Kimi - MiniMax|），分歧 ≥20 的球员
            在名单中标记 ⚠，提示该预测存在较大不确定性。
          </li>
          <li>
            <strong className="text-[var(--foreground)]">新星推断：</strong>
            对每支球队，额外请求 Kimi 推测3名当前不在大名单内、但可能在2030年入选的年轻球员，
            结果明确标注「模型推断」。
          </li>
          <li>
            <strong className="text-[var(--foreground)]">五维雷达：</strong>
            年龄纵深、联赛水平、国际经验、数据产出、生涯趋势 —— 这五个维度由本地启发式规则
            （非模型调用）从公开字段计算得出，用于可视化辅助理解，不代表额外的模型判断。
          </li>
          <li>
            <strong className="text-[var(--foreground)]">最新动态：</strong>
            用户点击「查询最新动态」时，实时抓取 DuckDuckGo 公开搜索结果，交由 Kimi 生成中文摘要
            并判断信号（上升/平稳/下滑），结果按球员名缓存15分钟。
          </li>
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Gonka 集成 · Gonka Integration</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          所有模型调用均通过 GonkaRouter（https://api.gonkarouter.io/v1）完成。每次调用返回的
          Request ID 会被记录并展示在球员详情页与右下角悬浮徽章中，便于审计与复现。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">迭代计划 · Iteration Plan</h2>
        <ul className="text-sm text-[var(--muted)] leading-relaxed list-disc pl-5 space-y-1">
          <li>接入更多联赛/伤病数据源，提升联赛水平评分的时效性</li>
          <li>引入历史世界杯留队率作为校准基准（calibration baseline）</li>
          <li>扩展至全部32强国家队</li>
          <li>加入第三个模型做三方交叉验证，进一步降低单模型偏差</li>
          <li>球员动态摘要接入更稳定的新闻源 API，替代 HTML 抓取</li>
        </ul>
      </section>
    </div>
  );
}
