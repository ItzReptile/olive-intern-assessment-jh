
  create table "public"."quizzes" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "prompt" text not null,
    "spec" jsonb not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."responses" (
    "id" uuid not null default gen_random_uuid(),
    "quiz_id" uuid not null,
    "answers" jsonb not null,
    "score" integer not null,
    "result_title" text not null,
    "started_at" timestamp with time zone default now(),
    "completed_at" timestamp with time zone
      );


CREATE UNIQUE INDEX quizzes_pkey ON public.quizzes USING btree (id);

CREATE UNIQUE INDEX responses_pkey ON public.responses USING btree (id);

alter table "public"."quizzes" add constraint "quizzes_pkey" PRIMARY KEY using index "quizzes_pkey";

alter table "public"."responses" add constraint "responses_pkey" PRIMARY KEY using index "responses_pkey";

alter table "public"."responses" add constraint "responses_quiz_id_fkey" FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE not valid;

alter table "public"."responses" validate constraint "responses_quiz_id_fkey";

grant delete on table "public"."quizzes" to "anon";

grant insert on table "public"."quizzes" to "anon";

grant references on table "public"."quizzes" to "anon";

grant select on table "public"."quizzes" to "anon";

grant trigger on table "public"."quizzes" to "anon";

grant truncate on table "public"."quizzes" to "anon";

grant update on table "public"."quizzes" to "anon";

grant delete on table "public"."quizzes" to "authenticated";

grant insert on table "public"."quizzes" to "authenticated";

grant references on table "public"."quizzes" to "authenticated";

grant select on table "public"."quizzes" to "authenticated";

grant trigger on table "public"."quizzes" to "authenticated";

grant truncate on table "public"."quizzes" to "authenticated";

grant update on table "public"."quizzes" to "authenticated";

grant delete on table "public"."quizzes" to "service_role";

grant insert on table "public"."quizzes" to "service_role";

grant references on table "public"."quizzes" to "service_role";

grant select on table "public"."quizzes" to "service_role";

grant trigger on table "public"."quizzes" to "service_role";

grant truncate on table "public"."quizzes" to "service_role";

grant update on table "public"."quizzes" to "service_role";

grant delete on table "public"."responses" to "anon";

grant insert on table "public"."responses" to "anon";

grant references on table "public"."responses" to "anon";

grant select on table "public"."responses" to "anon";

grant trigger on table "public"."responses" to "anon";

grant truncate on table "public"."responses" to "anon";

grant update on table "public"."responses" to "anon";

grant delete on table "public"."responses" to "authenticated";

grant insert on table "public"."responses" to "authenticated";

grant references on table "public"."responses" to "authenticated";

grant select on table "public"."responses" to "authenticated";

grant trigger on table "public"."responses" to "authenticated";

grant truncate on table "public"."responses" to "authenticated";

grant update on table "public"."responses" to "authenticated";

grant delete on table "public"."responses" to "service_role";

grant insert on table "public"."responses" to "service_role";

grant references on table "public"."responses" to "service_role";

grant select on table "public"."responses" to "service_role";

grant trigger on table "public"."responses" to "service_role";

grant truncate on table "public"."responses" to "service_role";

grant update on table "public"."responses" to "service_role";


