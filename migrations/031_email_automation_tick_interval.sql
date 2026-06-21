-- =============================================
-- Migration 031: Reduz intervalo do cron do worker de automação de email
-- =============================================
-- O worker (email-automation-tick) rodava só a cada 10 min, então mesmo
-- "Iniciar agora" (que matricula e agenda o primeiro envio pra "já") podia
-- levar quase 10 min até o e-mail de fato entrar na fila de processamento.
-- O espaçamento entre chamadas de IA pro Gemini já é controlado dentro de
-- cada execução (4.5s por geração), então reduzir a frequência do cron não
-- corre risco de esgotar a cota por minuto. Reduz pra 2 min.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'email-automation-tick';
SELECT cron.schedule('email-automation-tick', '*/2 * * * *', 'SELECT email_automation_tick_call();');
