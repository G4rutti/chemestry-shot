

using System.ComponentModel.DataAnnotations;

namespace ClinicaASPNet.Models
{
    public class Paciente
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Campo Obrigatótio")]
        [StringLength(100, MinimumLength = 3,
            ErrorMessage = "O Nome deve possuir entre 3 e 100 Caracteres")]
        [Display(Name = "Nome Completo")]
        public string Nome { get; set; } = string.Empty;

        [Required(ErrorMessage = "Campo obrigatório")]
        [RegularExpression(@"^\d{11}$", ErrorMessage = "Informe o cpf com 11 dígitos")]
        public string Cpf { get; set; } = string.Empty;

        [Required(ErrorMessage = "Campo obrigatório")]
        [Phone(ErrorMessage = "Informe um telefone válido")]
        public string Telefone { get; set; } = string.Empty;

        [Required(ErrorMessage = "Campo obrigatório")]
        [DataType(DataType.Date)]
        [Display(Name = "Data de Nascimento")]
        public DateTime DataNascimento { get; set; }

        public DateTime CriadoEm { get; set; }
        public DateTime AtualizadoEm { get; set; }
    }
}
