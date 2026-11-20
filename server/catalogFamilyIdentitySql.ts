export const CATALOG_FAMILY_IDENTITY_LATERAL_SQL = `left join lateral (
  select
    case
      when count(distinct nullif(coalesce(nullif(v.identity_specs->>'productType',''), technical_identity.product_type),'')) <= 1
        then max(coalesce(nullif(v.identity_specs->>'productType',''), technical_identity.product_type))
      else 'MIXED'
    end as product_type,
    case
      when count(distinct nullif(coalesce(nullif(v.identity_specs->>'material',''), technical_identity.material, f.materials),'')) <= 1
        then max(coalesce(nullif(v.identity_specs->>'material',''), technical_identity.material, f.materials))
      else 'MIXED'
    end as material,
    case
      when count(distinct nullif(coalesce(nullif(v.identity_specs->>'profile',''), technical_identity.profile),'')) <= 1
        then max(coalesce(nullif(v.identity_specs->>'profile',''), technical_identity.profile))
      else 'MIXED'
    end as profile,
    count(v.code)::integer as variant_count,
    string_agg(distinct v.name,' | ' order by v.name) as variant_names
  from public.catalog_variants v
  left join lateral (
    select
      case
        when count(distinct nullif(btrim(x->>'value'),'')) filter (
          where lower(regexp_replace(translate(coalesce(x->>'key',''), '‌‍‎‏', ''), '[[:space:]_-]+', '', 'g'))
            in ('producttype','productkind','نوعمحصول','نوعکالا','نوعتسمه','نوعقطعه')
        ) <= 1
        then max(nullif(btrim(x->>'value'),'')) filter (
          where lower(regexp_replace(translate(coalesce(x->>'key',''), '‌‍‎‏', ''), '[[:space:]_-]+', '', 'g'))
            in ('producttype','productkind','نوعمحصول','نوعکالا','نوعتسمه','نوعقطعه')
        )
        else 'MIXED'
      end as product_type,
      case
        when count(distinct nullif(btrim(x->>'value'),'')) filter (
          where lower(regexp_replace(translate(coalesce(x->>'key',''), '‌‍‎‏', ''), '[[:space:]_-]+', '', 'g'))
            in ('material','beltmaterial','جنس','جنستسمه','جنسومتریال','جنسدرجشده','جنسبدنه','ماده')
        ) <= 1
        then max(nullif(btrim(x->>'value'),'')) filter (
          where lower(regexp_replace(translate(coalesce(x->>'key',''), '‌‍‎‏', ''), '[[:space:]_-]+', '', 'g'))
            in ('material','beltmaterial','جنس','جنستسمه','جنسومتریال','جنسدرجشده','جنسبدنه','ماده')
        )
        else 'MIXED'
      end as material,
      case
        when count(distinct nullif(btrim(x->>'value'),'')) filter (
          where lower(regexp_replace(translate(coalesce(x->>'key',''), '‌‍‎‏', ''), '[[:space:]_-]+', '', 'g'))
            in ('profile','profilecode','beltprofile','beltprofilecode','پروفیل','پروفایل','پروفیلتسمه','پروفایلتسمه','پروفیل/مدل','پروفایل/مدل','پروفیلمدل','پروفیلومدل','پروفیلدرجشده','پروفایلدردجشده','نوعپروفیل')
        ) <= 1
        then max(nullif(btrim(x->>'value'),'')) filter (
          where lower(regexp_replace(translate(coalesce(x->>'key',''), '‌‍‎‏', ''), '[[:space:]_-]+', '', 'g'))
            in ('profile','profilecode','beltprofile','beltprofilecode','پروفیل','پروفایل','پروفیلتسمه','پروفایلتسمه','پروفیل/مدل','پروفایل/مدل','پروفیلمدل','پروفیلومدل','پروفیلدرجشده','پروفایلدردجشده','نوعپروفیل')
        )
        else 'MIXED'
      end as profile
    from jsonb_array_elements(
      case
        when jsonb_typeof(v.technical_specs)='array' then v.technical_specs
        when jsonb_typeof(v.technical_specs)='object' and v.technical_specs ? 'key'
          then jsonb_build_array(v.technical_specs)
        else '[]'::jsonb
      end
    ) x
  ) technical_identity on true
  where v.family_code=f.code and v.active=true
) identity on true`;
