using System.Runtime.InteropServices.Marshalling;

namespace ClinicaASPNet.Models
{
    public class Especialidade
    {
        public int   Id { get; set; }
        public string Nome { get; set; }
        public string Descricao  { get; set; }

        public ICollection<Profissional> Profissionais { get; set; } = new List<Profissional>();

    }
}
