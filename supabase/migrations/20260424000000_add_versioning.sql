-- Quiz versioning: bump on each edit, snapshot the prior spec, stamp responses.

alter table "public"."quizzes" add column "version" integer not null default 1;

create table "public"."quiz_versions" (
  "id" uuid not null default gen_random_uuid(),
  "quiz_id" uuid not null,
  "version" integer not null,
  "title" text not null,
  "description" text,
  "spec" jsonb not null,
  "created_at" timestamp with time zone default now()
);

create unique index quiz_versions_pkey on public.quiz_versions using btree (id);
create unique index quiz_versions_quiz_id_version_key on public.quiz_versions using btree (quiz_id, version);
create index quiz_versions_quiz_id_idx on public.quiz_versions using btree (quiz_id);

alter table "public"."quiz_versions" add constraint "quiz_versions_pkey" primary key using index "quiz_versions_pkey";
alter table "public"."quiz_versions" add constraint "quiz_versions_quiz_id_version_key" unique using index "quiz_versions_quiz_id_version_key";
alter table "public"."quiz_versions" add constraint "quiz_versions_quiz_id_fkey" foreign key (quiz_id) references public.quizzes(id) on delete cascade not valid;
alter table "public"."quiz_versions" validate constraint "quiz_versions_quiz_id_fkey";

alter table "public"."responses" add column "version" integer not null default 1;
create index responses_quiz_id_version_idx on public.responses using btree (quiz_id, version);

-- Grants mirror the quizzes/responses policy set.
grant delete, insert, references, select, trigger, truncate, update on table "public"."quiz_versions" to "anon";
grant delete, insert, references, select, trigger, truncate, update on table "public"."quiz_versions" to "authenticated";
grant delete, insert, references, select, trigger, truncate, update on table "public"."quiz_versions" to "service_role";
