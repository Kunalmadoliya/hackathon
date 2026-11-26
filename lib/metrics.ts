/**
 * FILE GUIDE
 * SQL for the admin metrics page: theme adoption, opt-outs, theme impact, board views,
 * name visibility, growth, title tests, top-3 share. Used by: app/admin/metrics.
 */
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { istWeekStart } from "./queries";

const one = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows[0] as T;
const all = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];

/** Postgres-side success metrics (PRD section 9). Flagsmith-side ones are read separately. */
export async function getAppMetrics() {
  const week = istWeekStart();
  const lastWeek = new Date(week.getTime() - 7 * 86400000);

  const [themeAdoption, optOut, themeImpact, visibility, boardViews, growth, titleTests, topShare] = await Promise.all([
    one<{ with_custom: number; sellers: number }>(sql`
      select (select count(*)::int from sellers s where exists (select 1 from themes t where t.seller_id = s.id)) as with_custom,
             (select count(*)::int from sellers) as sellers`),

    // Users who turned a store's look off, divided by users who visited that store.
    all<{ store_name: string; visitors: number; opted_out: number }>(sql`
      select s.store_name,
        (select count(distinct e.user_id)::int from events e where e.type = 'store_view' and e.seller_id = s.id) as visitors,
        (select count(distinct p.user_id)::int from user_prefs p where p.seller_id = s.id and p.use_seller_theme = false
           and exists (select 1 from events e where e.type = 'store_view' and e.seller_id = s.id and e.user_id = p.user_id)) as opted_out
      from sellers s order by s.id`),

    // Orders per store visit, stores with their own live look vs stores on a Platter look. Descriptive.
    all<{ grp: string; visits: number; orders: number }>(sql`
      with g as (
        select s.id, case when t.seller_id = s.id then 'custom' else 'default' end as grp
        from sellers s left join themes t on t.id = s.active_theme_id
      )
      select g.grp,
        (select count(*)::int from events e where e.type = 'store_view' and e.seller_id in (select id from g g2 where g2.grp = g.grp)) as visits,
        (select count(*)::int from orders o where o.seller_id in (select id from g g2 where g2.grp = g.grp)
           and o.created_at >= (select coalesce(min(created_at), now()) from events where type = 'store_view')) as orders
      from g group by g.grp order by g.grp`),

    one<{ visible: number; sellers: number }>(sql`
      select count(*) filter (where leaderboard_show_name)::int as visible, count(*)::int as sellers from sellers`),

    one<{ views: number; viewers: number }>(sql`
      select count(*)::int as views, count(distinct user_id)::int as viewers from events where type = 'leaderboard_view'`),

    // Week-over-week order growth, sellers with name shown vs hidden. Descriptive.
    all<{ grp: string; this_week: number; last_week: number }>(sql`
      select case when s.leaderboard_show_name then 'shown' else 'hidden' end as grp,
        count(o.id) filter (where o.created_at >= ${week.toISOString()})::int as this_week,
        count(o.id) filter (where o.created_at >= ${lastWeek.toISOString()} and o.created_at < ${week.toISOString()})::int as last_week
      from sellers s left join orders o on o.seller_id = s.id and o.status = 'completed'
      group by 1 order by 1 desc`),

    one<{ run: number; completed: number; avg_uplift: number | null }>(sql`
      with per as (
        select t.id, t.status, t.winner,
          count(*) filter (where e.variant = 'a' and e.type = 'view') as va,
          count(*) filter (where e.variant = 'a' and e.type = 'order') as oa,
          count(*) filter (where e.variant = 'b' and e.type = 'view') as vb,
          count(*) filter (where e.variant = 'b' and e.type = 'order') as ob
        from title_tests t left join title_events e on e.test_id = t.id group by t.id
      )
      select count(*)::int as run,
        count(*) filter (where status = 'ended')::int as completed,
        avg(case when status = 'ended' and va > 0 and vb > 0 and oa > 0
          then ((case when winner = 'b' then ob::float / vb else oa::float / va end)
               / (case when winner = 'b' then oa::float / va else ob::float / vb end) - 1) end)::float as avg_uplift
      from per`),

    // Guardrail: share of the last 30 days' orders going to the top 3 sellers.
    one<{ top3: number; total: number; sellers: number }>(sql`
      with c as (
        select seller_id, count(*) as n from orders where created_at >= now() - interval '30 days' group by seller_id
      )
      select coalesce((select sum(n) from (select n from c order by n desc limit 3) x), 0)::int as top3,
             coalesce((select sum(n) from c), 0)::int as total,
             (select count(*)::int from sellers) as sellers`),
  ]);

  return { themeAdoption, optOut, themeImpact, visibility, boardViews, growth, titleTests, topShare };
}
