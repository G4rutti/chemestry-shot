using ClinicaASPNet.Data;
using ClinicaASPNet.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ClinicaASPNet.Repositories
{
    public class RepositoryBase<TEntity> : IRepositotyBase<TEntity> where TEntity: class
    {
        private readonly ClinicaDbContext _context;
        private readonly DbSet<TEntity> DbSet;
        public RepositoryBase(ClinicaDbContext context)
        {
            _context = context;
            DbSet = context.Set<TEntity>();
        }

        public void Alterar(TEntity objeto)
        {
           DbSet.Update(objeto);
        }

        public async Task AlterarAsync(TEntity objeto)
        {
            _context.Entry<TEntity>(objeto).State = EntityState.Modified;
            await _context.SaveChangesAsync();
        }

        public void Excluir(TEntity objeto)
        {
            _context.Set<TEntity>().Remove(objeto);
            _context.SaveChanges();
        }

        public async Task ExcluirAsync(TEntity objeto)
        {
            _context.Set<TEntity>().Remove(objeto);
            await _context.SaveChangesAsync();
        }

        public void Incluir(TEntity objeto)
        {
             _context.Set<TEntity>().Add(objeto);
             _context.SaveChanges();
        }

        public async Task IncluirAsync(TEntity objeto)
        {
           await _context.Set<TEntity>().AddAsync(objeto);
            await _context.SaveChangesAsync();

        }

        public IReadOnlyList<TEntity> ListarTodos()
        {
            return _context.Set<TEntity>().ToList();
        }

        public async Task<IReadOnlyList<TEntity>> ListarTodosAsync()
        {
              return await _context.Set<TEntity>().ToListAsync();
        }

        public TEntity SelecionarPorId(int id)
        {
            return DbSet.Find([id]);
        }

        public async Task<TEntity> SelecionarPorIdAsync(int id)
        {
            return await DbSet.FindAsync([id]);
        }
    }
}
