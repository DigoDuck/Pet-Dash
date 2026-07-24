interface AlertasDoPetProps {
  agressivo: boolean;
  otite: boolean;
  problemaPele: boolean;
}

/** Avisos do cadastro do pet, exibidos na CRIAÇÃO do atendimento. Lista filtrada em vez
 *  de três blocos condicionais: condição nova é uma linha aqui, não um `&&` novo no JSX
 *  do formulário. */
export function AlertasDoPet({ agressivo, otite, problemaPele }: AlertasDoPetProps) {
  const alertas = [
    agressivo && "Este pet foi cadastrado como agressivo — manejo especial já marcado (+40%).",
    otite && "Este pet tem otite — cuidado com o ouvido no banho.",
    problemaPele && "Este pet tem problema de pele — atenção ao produto do banho.",
  ].filter((a): a is string => typeof a === "string");

  if (alertas.length === 0) return null;

  return (
    <div className="rounded-lg border border-erro/30 bg-erro/5 p-4">
      <p className="text-sm font-medium text-escuro">Alertas deste pet</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-neutro">
        {alertas.map((alerta) => (
          <li key={alerta}>{alerta}</li>
        ))}
      </ul>
    </div>
  );
}
