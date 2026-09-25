using System.ComponentModel.DataAnnotations;
using System.Reflection.Metadata.Ecma335;

namespace ClinicaASPNet.Models
{
    public class Profissional
    {
        public int Id { get; set; }

        public string Nome { get; set; }
        public string RegistroProfissional { get; set; }
        public  string Telefone { get; set; }

        public ICollection<Especialidade> Especialidades { get; set; } = new List<Especialidade>();
    }
}
