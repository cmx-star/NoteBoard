// NoteBoard Infographic 现代化高颜值信息图渲染器
// 自适应主题色彩，支持指标看板、时间线、步骤流程、转化漏斗、对比矩阵、四象限与统计图表

import React from 'react';
import type {
  InfographicData,
  InfographicItem,
  ComparisonGroup,
  QuadrantItem,
} from './infographicTypes';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

interface InfographicRendererProps {
  data: InfographicData;
}

/** 预置主题色彩色板（支持浅色与暗黑模式自适应） */
const COLOR_MAP: Record<string, { bg: string; border: string; text: string; lightBg: string }> = {
  blue: { bg: 'var(--nb-blue-500)', border: 'var(--nb-blue-300)', text: 'var(--nb-blue-600)', lightBg: 'var(--nb-auto-3b82f6-a8)' },
  emerald: { bg: 'var(--nb-emerald-500)', border: 'var(--nb-emerald-200)', text: 'var(--nb-emerald-600)', lightBg: 'var(--nb-auto-10b981-a8)' },
  green: { bg: 'var(--nb-green-500)', border: 'var(--nb-green-200)', text: 'var(--nb-green-600)', lightBg: 'var(--nb-auto-22c55e-a8)' },
  purple: { bg: 'var(--nb-purple-500)', border: 'var(--nb-auto-ddd6fe)', text: 'var(--nb-purple-600)', lightBg: 'var(--nb-auto-8b5cf6-a8)' },
  amber: { bg: 'var(--nb-amber-500)', border: 'var(--nb-amber-200)', text: 'var(--nb-amber-600)', lightBg: 'var(--nb-auto-f59e0b-a8)' },
  red: { bg: 'var(--nb-red-500)', border: 'var(--nb-red-200)', text: 'var(--nb-red-600)', lightBg: 'var(--nb-auto-ef4444-a8)' },
  cyan: { bg: 'var(--nb-cyan-500)', border: 'var(--nb-cyan-200)', text: 'var(--nb-cyan-600)', lightBg: 'var(--nb-auto-06b6d4-a8)' },
  gray: { bg: 'var(--nb-slate-500)', border: 'var(--nb-slate-300)', text: 'var(--nb-slate-600)', lightBg: 'var(--nb-auto-64748b-a8)' },
};

function getColor(colorName?: string) {
  if (!colorName) return COLOR_MAP.blue;
  return COLOR_MAP[colorName.toLowerCase()] || COLOR_MAP.blue;
}

/**
 * 1. 指标看板组件 (Metric Cards)
 */
function MetricCardsView({ items }: { items: InfographicItem[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(var(--dim-200), 1fr))',
        gap: 'var(--dim-14)',
        width: 'var(--pct-100)',
      }}
    >
      {items.map((item, idx) => {
        const c = getColor(item.color);
        return (
          <div
            key={idx}
            style={{
              padding: 'var(--dim-16) var(--dim-18)',
              borderRadius: 'var(--dim-10)',
              background: 'var(--editor-surface)',
              border: 'var(--dim-1) solid var(--editor-border)',
              boxShadow: '0 var(--dim-2) var(--dim-8) var(--nb-black-a03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--dim-8)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
          >
            {/* 顶端色彩装饰条 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 'var(--dim-3)',
                background: `linear-gradient(var(--rotate-90), ${c.bg}, ${c.border})`,
              }}
            />

            {/* 标签标题与趋势指示 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-13)', color: 'var(--editor-text-muted)', fontWeight: 'var(--weight-500)' }}>
                {item.label || item.title || '指标'}
              </span>
              {item.change && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--dim-3)',
                    padding: 'var(--dim-2) var(--dim-7)',
                    borderRadius: 'var(--dim-12)',
                    fontSize: 'var(--text-11)',
                    fontWeight: 'var(--weight-600)',
                    background: item.trend === 'down' ? 'var(--nb-auto-ef4444-a12)' : 'var(--nb-auto-10b981-a12)',
                    color: item.trend === 'down' ? 'var(--nb-red-600)' : 'var(--nb-green-600)',
                  }}
                >
                  {item.trend === 'up' && <TrendingUp size={11} />}
                  {item.trend === 'down' && <TrendingDown size={11} />}
                  {item.trend === 'neutral' && <Minus size={11} />}
                  <span>{item.change}</span>
                </div>
              )}
            </div>

            {/* 核心数值展示 */}
            <div
              style={{
                fontSize: 'var(--text-26)',
                fontWeight: 'var(--weight-700)',
                color: 'var(--editor-text)',
                letterSpacing: '-var(--em-0-02)',
                lineHeight: 'var(--leading-1-2)',
              }}
            >
              {item.value ?? '-'}
            </div>

            {/* 补充说明文本 */}
            {(item.desc || item.description) && (
              <div
                style={{
                  fontSize: 'var(--text-11)',
                  color: 'var(--editor-text-muted)',
                  lineHeight: 'var(--leading-1-4)',
                  marginTop: 'var(--dim-2)',
                }}
              >
                {item.desc || item.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 2. 时间线组件 (Timeline)
 */
function TimelineView({ items }: { items: InfographicItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 'var(--dim-10) 0', width: 'var(--pct-100)' }}>
      {items.map((item, idx) => {
        const c = getColor(item.color);
        const isLast = idx === items.length - 1;
        const isDone = item.status === 'done';
        const isActive = item.status === 'active';

        return (
          <div key={idx} style={{ display: 'flex', gap: 'var(--dim-16)', position: 'relative' }}>
            {/* 时间线轴与圆点 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 'var(--dim-24)' }}>
              <div
                style={{
                  width: 'var(--dim-14)',
                  height: 'var(--dim-14)',
                  borderRadius: 'var(--pct-50)',
                  background: isDone ? c.bg : isActive ? 'var(--editor-surface)' : 'var(--editor-border)',
                  border: `var(--dim-3) solid ${c.bg}`,
                  boxShadow: isActive ? `0 0 0 var(--dim-4) ${c.lightBg}` : 'none',
                  zIndex: 'var(--z-2)',
                }}
              />
              {!isLast && (
                <div
                  style={{
                    width: 'var(--dim-2)',
                    flex: 1,
                    minHeight: 'var(--dim-44)',
                    background: isDone ? c.bg : 'var(--editor-border)',
                    margin: 'var(--dim-4) 0',
                  }}
                />
              )}
            </div>

            {/* 阶段卡片内容 */}
            <div
              style={{
                flex: 1,
                padding: '0 0 var(--dim-20) 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--dim-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-8)' }}>
                {item.label && (
                  <span
                    style={{
                      fontSize: 'var(--text-11)',
                      fontWeight: 'var(--weight-600)',
                      padding: 'var(--dim-2) var(--dim-8)',
                      borderRadius: 'var(--dim-10)',
                      background: c.lightBg,
                      color: c.text,
                    }}
                  >
                    {item.label}
                  </span>
                )}
                <span style={{ fontSize: 'var(--text-14)', fontWeight: 'var(--weight-600)', color: 'var(--editor-text)' }}>
                  {item.title || item.name}
                </span>
              </div>
              {(item.desc || item.description) && (
                <div style={{ fontSize: 'var(--text-12)', color: 'var(--editor-text-muted)', lineHeight: 'var(--leading-1-5)' }}>
                  {item.desc || item.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 3. 业务步骤组件 (Process Steps)
 */
function ProcessStepsView({ items }: { items: InfographicItem[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(var(--dim-180), 1fr))',
        gap: 'var(--dim-12)',
        width: 'var(--pct-100)',
        alignItems: 'stretch',
      }}
    >
      {items.map((item, idx) => {
        const c = getColor(item.color);
        return (
          <div
            key={idx}
            style={{
              padding: 'var(--dim-14) var(--dim-16)',
              borderRadius: 'var(--dim-8)',
              background: 'var(--editor-surface)',
              border: 'var(--dim-1) solid var(--editor-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--dim-8)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-8)' }}>
              <div
                style={{
                  width: 'var(--dim-22)',
                  height: 'var(--dim-22)',
                  borderRadius: 'var(--dim-6)',
                  background: c.bg,
                  color: 'var(--nb-white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-12)',
                  fontWeight: 'var(--weight-700)',
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>
              <span style={{ fontSize: 'var(--text-13)', fontWeight: 'var(--weight-600)', color: 'var(--editor-text)' }}>
                {item.title || item.label}
              </span>
            </div>
            {(item.desc || item.description) && (
              <div style={{ fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)', lineHeight: 'var(--leading-1-45)' }}>
                {item.desc || item.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 4. 转化漏斗组件 (Funnel)
 */
function FunnelView({ items }: { items: InfographicItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-8)', width: 'var(--pct-100)', maxWidth: 'var(--dim-580)', margin: '0 auto' }}>
      {items.map((item, idx) => {
        const c = getColor(item.color);
        // 按阶梯收窄宽度展示漏斗感
        const widthPct = Math.max(45, 100 - idx * 14);

        return (
          <div
            key={idx}
            style={{
              width: `${widthPct}%`,
              margin: '0 auto',
              padding: 'var(--dim-10) var(--dim-16)',
              borderRadius: 'var(--dim-8)',
              background: `linear-gradient(var(--rotate-135), ${c.bg}, ${c.border})`,
              color: 'var(--nb-white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 var(--dim-2) var(--dim-8) var(--nb-black-a06)',
              transition: 'transform 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-8)' }}>
              <span style={{ fontSize: 'var(--text-12)', fontWeight: 'var(--weight-700)', opacity: 'var(--opacity-0-85)' }}>0{idx + 1}</span>
              <span style={{ fontSize: 'var(--text-13)', fontWeight: 'var(--weight-600)' }}>{item.label || item.title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-10)' }}>
              <span style={{ fontSize: 'var(--text-14)', fontWeight: 'var(--weight-700)' }}>{item.value}</span>
              {item.change && (
                <span style={{ fontSize: 'var(--text-11)', opacity: 'var(--opacity-0-9)', background: 'var(--nb-white-a20)', padding: 'var(--dim-1) var(--dim-6)', borderRadius: 'var(--dim-10)' }}>
                  {item.change}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 5. 方案对比表 (Comparison)
 */
function ComparisonView({ groups }: { groups: ComparisonGroup[] }) {
  if (!groups || groups.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${groups.length}, 1fr)`,
        gap: 'var(--dim-14)',
        width: 'var(--pct-100)',
      }}
    >
      {groups.map((group, idx) => {
        const isHighlight = Boolean(group.highlight);
        const c = getColor(group.color);

        return (
          <div
            key={idx}
            style={{
              borderRadius: 'var(--dim-10)',
              border: isHighlight ? `var(--dim-2) solid ${c.bg}` : 'var(--dim-1) solid var(--editor-border)',
              background: 'var(--editor-surface)',
              boxShadow: isHighlight ? `0 var(--dim-4) var(--dim-16) ${c.lightBg}` : '0 var(--dim-2) var(--dim-6) var(--nb-black-a02)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* 组头 */}
            <div
              style={{
                padding: 'var(--dim-14) var(--dim-16)',
                borderBottom: 'var(--dim-1) solid var(--editor-border)',
                background: isHighlight ? c.lightBg : 'var(--editor-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-6)' }}>
                <span style={{ fontSize: 'var(--text-14)', fontWeight: 'var(--weight-700)', color: 'var(--editor-text)' }}>
                  {group.name}
                </span>
                {isHighlight && <Sparkles size={13} color={c.text} />}
              </div>
              {group.badge && (
                <span
                  style={{
                    fontSize: 'var(--text-10)',
                    fontWeight: 'var(--weight-600)',
                    padding: 'var(--dim-2) var(--dim-8)',
                    borderRadius: 'var(--dim-10)',
                    background: c.bg,
                    color: 'var(--nb-white)',
                  }}
                >
                  {group.badge}
                </span>
              )}
            </div>

            {/* 特性项目列表 */}
            <div style={{ padding: 'var(--dim-12) var(--dim-16)', display: 'flex', flexDirection: 'column', gap: 'var(--dim-10)' }}>
              {(group.features || []).map((feat, fIdx) => (
                <div
                  key={fIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 'var(--dim-8)',
                    fontSize: 'var(--text-12)',
                    borderBottom: fIdx < group.features.length - 1 ? 'var(--dim-1) dashed var(--editor-border)' : 'none',
                    paddingBottom: 'var(--dim-8)',
                  }}
                >
                  <span style={{ color: 'var(--editor-text-muted)' }}>{feat.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-4)', fontWeight: 'var(--weight-500)' }}>
                    {feat.included === true && <Check size={14} color="var(--nb-green-600)" />}
                    {feat.included === false && <X size={14} color="var(--nb-red-600)" />}
                    {feat.value !== undefined && feat.value !== true && feat.value !== false && (
                      <span style={{ color: 'var(--editor-text)' }}>{String(feat.value)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 6. 四象限矩阵 (Quadrant Matrix)
 */
function QuadrantView({ data }: { data: InfographicData }) {
  const points = data.points || [];
  const q = data.quadrants || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-12)', width: 'var(--pct-100)' }}>
      {/* 轴标签指示 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-11)', color: 'var(--editor-text-muted)' }}>
        <span>⬆ {data.quadrantYLabel || '纵轴 (高)'}</span>
        <span>{data.quadrantXLabel || '横轴 (低 → 高)'} ➡</span>
      </div>

      {/* 四象限网格底板 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 'var(--dim-8)',
          minHeight: 'var(--dim-280)',
          position: 'relative',
        }}
      >
        {/* Q2 左上 */}
        <div
          style={{
            padding: 'var(--dim-12)',
            borderRadius: 'var(--dim-8)',
            background: 'var(--editor-surface)',
            border: 'var(--dim-1) solid var(--editor-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dim-4)',
          }}
        >
          <span style={{ fontSize: 'var(--text-12)', fontWeight: 'var(--weight-700)', color: 'var(--nb-blue-500)' }}>
            {q.q2?.title || '第二象限 (左上)'}
          </span>
          <span style={{ fontSize: 'var(--text-10)', color: 'var(--editor-text-muted)' }}>{q.q2?.desc}</span>
        </div>

        {/* Q1 右上 */}
        <div
          style={{
            padding: 'var(--dim-12)',
            borderRadius: 'var(--dim-8)',
            background: 'var(--nb-auto-10b981-a5)',
            border: 'var(--dim-1) solid var(--nb-auto-10b981-a25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dim-4)',
          }}
        >
          <span style={{ fontSize: 'var(--text-12)', fontWeight: 'var(--weight-700)', color: 'var(--nb-emerald-500)' }}>
            {q.q1?.title || '第一象限 (右上)'}
          </span>
          <span style={{ fontSize: 'var(--text-10)', color: 'var(--editor-text-muted)' }}>{q.q1?.desc}</span>
        </div>

        {/* Q3 左下 */}
        <div
          style={{
            padding: 'var(--dim-12)',
            borderRadius: 'var(--dim-8)',
            background: 'var(--editor-bg)',
            border: 'var(--dim-1) solid var(--editor-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dim-4)',
          }}
        >
          <span style={{ fontSize: 'var(--text-12)', fontWeight: 'var(--weight-700)', color: 'var(--nb-slate-500)' }}>
            {q.q3?.title || '第三象限 (左下)'}
          </span>
          <span style={{ fontSize: 'var(--text-10)', color: 'var(--editor-text-muted)' }}>{q.q3?.desc}</span>
        </div>

        {/* Q4 右下 */}
        <div
          style={{
            padding: 'var(--dim-12)',
            borderRadius: 'var(--dim-8)',
            background: 'var(--editor-surface)',
            border: 'var(--dim-1) solid var(--editor-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--dim-4)',
          }}
        >
          <span style={{ fontSize: 'var(--text-12)', fontWeight: 'var(--weight-700)', color: 'var(--nb-amber-500)' }}>
            {q.q4?.title || '第四象限 (右下)'}
          </span>
          <span style={{ fontSize: 'var(--text-10)', color: 'var(--editor-text-muted)' }}>{q.q4?.desc}</span>
        </div>
      </div>

      {/* 散点要素清单标签 */}
      {points.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--dim-6)', marginTop: 'var(--dim-4)' }}>
          {points.map((p: QuadrantItem, idx: number) => {
            const c = getColor(p.color);
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--dim-5)',
                  padding: 'var(--dim-3) var(--dim-9)',
                  borderRadius: 'var(--dim-12)',
                  background: c.lightBg,
                  border: `var(--dim-1) solid ${c.border}`,
                  fontSize: 'var(--text-11)',
                  color: c.text,
                  fontWeight: 'var(--weight-500)',
                }}
              >
                <div style={{ width: 'var(--dim-6)', height: 'var(--dim-6)', borderRadius: 'var(--pct-50)', background: c.bg }} />
                <span>{p.name}</span>
                {p.desc && <span style={{ opacity: 'var(--opacity-0-75)', fontSize: 'var(--text-10)' }}>({p.desc})</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 7. 轻量 SVG 统计图表 (Chart)
 */
function ChartView({ data }: { data: InfographicData }) {
  const chart = data.chart;
  if (!chart || !chart.categories || chart.categories.length === 0) return null;

  const categories = chart.categories;
  const series = chart.series || [];
  const maxVal = Math.max(
    1,
    ...series.flatMap((s) => s.data || []),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-14)', width: 'var(--pct-100)' }}>
      {/* 柱状图列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-10)' }}>
        {categories.map((cat, catIdx) => (
          <div key={catIdx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dim-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-12)' }}>
              <span style={{ fontWeight: 'var(--weight-500)', color: 'var(--editor-text)' }}>{cat}</span>
            </div>
            {series.map((s, sIdx) => {
              const val = s.data[catIdx] ?? 0;
              const pct = Math.min(100, Math.round((val / maxVal) * 100));
              const c = getColor(s.color || (sIdx === 0 ? 'blue' : 'emerald'));

              return (
                <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-10)' }}>
                  <div
                    style={{
                      flex: 1,
                      height: 'var(--dim-16)',
                      borderRadius: 'var(--dim-4)',
                      background: 'var(--editor-bg)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: 'var(--pct-100)',
                        borderRadius: 'var(--dim-4)',
                        background: `linear-gradient(var(--rotate-90), ${c.bg}, ${c.border})`,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 'var(--text-11)', fontWeight: 'var(--weight-600)', minWidth: 'var(--dim-40)', textAlign: 'right', color: 'var(--editor-text)' }}>
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 系列图例 */}
      {series.length > 1 && (
        <div style={{ display: 'flex', gap: 'var(--dim-14)', justifyContent: 'center', fontSize: 'var(--text-11)' }}>
          {series.map((s, sIdx) => {
            const c = getColor(s.color || (sIdx === 0 ? 'blue' : 'emerald'));
            return (
              <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-5)' }}>
                <div style={{ width: 'var(--dim-10)', height: 'var(--dim-10)', borderRadius: 'var(--dim-2)', background: c.bg }} />
                <span style={{ color: 'var(--editor-text-muted)' }}>{s.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 主渲染器组件
 */
export function InfographicRenderer({ data }: InfographicRendererProps) {
  const items = data.data || data.items || [];

  return (
    <div
      className="nb-infographic-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--dim-14)',
        width: 'var(--pct-100)',
        padding: 'var(--dim-16) var(--dim-20)',
        borderRadius: 'var(--dim-10)',
        background: 'var(--editor-bg)',
        border: 'var(--dim-1) solid var(--editor-border)',
      }}
    >
      {/* 标题 */}
      {data.title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--dim-6)' }}>
            <span style={{ fontSize: 'var(--text-16)', fontWeight: 'var(--weight-700)', color: 'var(--editor-text)' }}>
              {data.title}
            </span>
          </div>
        </div>
      )}

      {/* 分发渲染对应类型的信息图 */}
      {data.type === 'metric-cards' && <MetricCardsView items={items} />}
      {data.type === 'timeline' && <TimelineView items={items} />}
      {data.type === 'process' && <ProcessStepsView items={items} />}
      {data.type === 'funnel' && <FunnelView items={items} />}
      {data.type === 'comparison' && <ComparisonView groups={data.groups || []} />}
      {data.type === 'quadrant' && <QuadrantView data={data} />}
      {data.type === 'chart' && <ChartView data={data} />}
      {data.type === 'list' && <ProcessStepsView items={items} />}
    </div>
  );
}
