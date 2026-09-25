using System.ComponentModel.DataAnnotations;

namespace ClinicaASPNet.ViewModels
{
    public class EspecialidadeViewModel
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Campo obrigatório")]
        [StringLength(100, MinimumLength = 3)]
        public string Nome { get; set; } = string.Empty;

        [Required(ErrorMessage = "Campo obrigatório")] 
        [StringLength(300)]
        public string Descricao { get; set; } = string.Empty;
    }
}
